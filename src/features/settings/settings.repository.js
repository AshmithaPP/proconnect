import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import { query } from '@/lib/db';
import { encryptSecret, decryptSecret } from '@/lib/security/secret-box';
import { SETTING_DEFAULTS } from '@/features/settings/settings.definitions';

const PUBLIC_SETTINGS_TAG = 'site-settings';

async function readStoredSetting(settingKey) {
  const rows = await query(`SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1`, [settingKey]);
  if (!rows.length) return {};
  const raw = rows[0].setting_value;
  // mysql2 returns JSON columns parsed; tolerate strings too
  return typeof raw === 'string' ? JSON.parse(raw) : raw || {};
}

async function writeSetting(settingKey, document, updatedByUserId) {
  await query(
    `INSERT INTO site_settings (setting_key, setting_value, updated_by_user_id)
     VALUES (?, CAST(? AS JSON), ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by_user_id = VALUES(updated_by_user_id)`,
    [settingKey, JSON.stringify(document), updatedByUserId || null]
  );
  revalidateTag(PUBLIC_SETTINGS_TAG);
}

/**
 * Settings as the admin forms see them: defaults merged with what is saved.
 * SMTP never includes the password — only `hasPassword`.
 * @param {'general' | 'seo' | 'smtp'} settingKey
 */
export async function getSetting(settingKey) {
  const { password, ...stored } = await readStoredSetting(settingKey);
  const merged = { ...SETTING_DEFAULTS[settingKey], ...stored };
  return settingKey === 'smtp' ? { ...merged, hasPassword: Boolean(password) } : merged;
}

/**
 * Cached read of the PUBLIC settings (general, seo) for the website itself — metadata,
 * robots.txt, sitemap. Refreshed instantly when an admin saves, and falls back to the
 * defaults if the database is unreachable (e.g. during a build without DB access).
 * @param {'general' | 'seo'} settingKey
 */
export async function getPublicSetting(settingKey) {
  if (settingKey !== 'general' && settingKey !== 'seo') {
    throw new Error(`"${settingKey}" is not a public setting`);
  }
  try {
    return await unstable_cache(() => getSetting(settingKey), ['public-setting', settingKey], {
      tags: [PUBLIC_SETTINGS_TAG],
      revalidate: 300,
    })();
  } catch (err) {
    console.error(`[Settings] Using defaults for "${settingKey}":`, err.message);
    return { ...SETTING_DEFAULTS[settingKey] };
  }
}

/**
 * @param {'general' | 'seo'} settingKey
 * @param {object} value - already validated with validateSetting()
 * @param {string} updatedByUserId
 */
export async function saveSetting(settingKey, value, updatedByUserId) {
  if (settingKey === 'smtp') throw new Error('Use saveSmtpSetting() for SMTP');
  await writeSetting(settingKey, value, updatedByUserId);
}

/**
 * Saves SMTP settings. The password is stored encrypted and only changes when a new one
 * is given (blank keeps the saved password) or `clearPassword` is set.
 * @param {object} value - validated with validateSetting('smtp', …)
 * @param {{ newPassword?: string, clearPassword?: boolean }} passwordChange
 * @param {string} updatedByUserId
 */
export async function saveSmtpSetting(value, { newPassword, clearPassword } = {}, updatedByUserId) {
  const { password: existingPassword } = await readStoredSetting('smtp');
  let password = existingPassword || null;
  if (clearPassword) password = null;
  if (newPassword) password = encryptSecret(newPassword);
  await writeSetting('smtp', { ...value, ...(password ? { password } : {}) }, updatedByUserId);
}

/**
 * Full SMTP configuration including the decrypted password — for the mailer only.
 * @returns {Promise<object & { password: string }>}
 */
export async function getSmtpCredentials() {
  const { password, ...stored } = await readStoredSetting('smtp');
  let plainPassword = '';
  if (password) {
    try {
      plainPassword = decryptSecret(password);
    } catch (err) {
      console.error('[Settings] SMTP password could not be decrypted (was SETTINGS_ENCRYPTION_KEY changed?):', err.message);
    }
  }
  return { ...SETTING_DEFAULTS.smtp, ...stored, password: plainPassword };
}
