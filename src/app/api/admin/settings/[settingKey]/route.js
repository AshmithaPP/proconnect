import { verifyPortalApiSession, verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import { SETTING_KEYS, validateSetting } from '@/features/settings/settings.definitions';
import { getSetting, saveSetting, saveSmtpSetting } from '@/features/settings/settings.repository';

/**
 * GET /api/admin/settings/{general|seo|smtp}  — admin only
 * PUT /api/admin/settings/{general|seo|smtp}  — admin only
 *
 * SMTP: the password is never returned (only `hasPassword`). On PUT, `password` sets a new
 * one, blank keeps the saved one, `clearPassword: true` removes it. Stored encrypted.
 */
async function resolveKey(params) {
  const { settingKey } = await params;
  return SETTING_KEYS.includes(settingKey) ? settingKey : null;
}

export async function GET(request, { params }) {
  const auth = await verifyPortalApiSession('superadmin');
  if (!auth.authorized) return auth.response;

  const settingKey = await resolveKey(params);
  if (!settingKey) return jsonNoStore({ error: 'Unknown setting' }, 404);

  try {
    return jsonNoStore({ settingKey, value: await getSetting(settingKey) });
  } catch (err) {
    console.error('Settings read error:', err.message);
    return jsonNoStore({ error: 'Could not load settings' }, 500);
  }
}

export async function PUT(request, { params }) {
  const auth = await verifyPortalApiRequest(request, 'superadmin');
  if (!auth.authorized) return auth.response;

  const settingKey = await resolveKey(params);
  if (!settingKey) return jsonNoStore({ error: 'Unknown setting' }, 404);

  const body = await readJsonBody(request);
  if (!body) return jsonNoStore({ error: 'Malformed JSON payload' }, 400);

  const { value, fieldErrors } = validateSetting(settingKey, body);
  if (settingKey === 'smtp') {
    const newPassword = typeof body.password === 'string' ? body.password : '';
    if (newPassword.length > 500) fieldErrors.password = 'Password is too long';
    // Sending with a username needs a password: a new one, or the saved one (unless cleared)
    if (value.isEnabled && value.username && !newPassword) {
      const current = await getSetting('smtp');
      if (!current.hasPassword || body.clearPassword === true) {
        fieldErrors.password = 'Password is required when a username is set';
      }
    }
  }
  if (Object.keys(fieldErrors).length) {
    return jsonNoStore({ error: 'Please fix the highlighted fields', fieldErrors }, 400);
  }

  try {
    if (settingKey === 'smtp') {
      await saveSmtpSetting(
        value,
        { newPassword: typeof body.password === 'string' ? body.password : '', clearPassword: body.clearPassword === true },
        auth.user.portalUserId
      );
    } else {
      await saveSetting(settingKey, value, auth.user.portalUserId);
    }
    return jsonNoStore({ success: true, settingKey, value: await getSetting(settingKey) });
  } catch (err) {
    console.error('Settings save error:', err.message);
    return jsonNoStore({ error: err.message.includes('SETTINGS_ENCRYPTION_KEY') ? err.message : 'Could not save settings' }, 500);
  }
}
