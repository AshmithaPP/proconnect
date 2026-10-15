/**
 * Site settings managed in the admin portal: defaults + validation.
 * Client-safe (no secrets) — shared by the settings forms and the API so they never drift.
 *
 * Each validator returns { value, fieldErrors } where `value` is the cleaned document.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOSTNAME_REGEX = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
const GA_ID_REGEX = /^(G-[A-Z0-9]{4,}|UA-\d{4,}-\d+)$/i;

export const SETTING_KEYS = ['general', 'seo', 'smtp'];

export const SMTP_SECURITY_OPTIONS = [
  { value: 'starttls', label: 'STARTTLS (usually port 587)' },
  { value: 'ssl', label: 'SSL/TLS (usually port 465)' },
  { value: 'none', label: 'None (local testing only)' },
];

export const SETTING_DEFAULTS = {
  general: {
    siteName: 'ProConnect',
    contactEmail: '',
    contactPhone: '',
    businessAddress: '',
    timezone: 'Asia/Kolkata',
    logoUrl: '',
  },
  seo: {
    metaTitle: 'Sales Strategy Consultant — Build a Sales Process That Drives Business Growth',
    metaDescription:
      'Helping companies strengthen their sales strategy, improve lead conversion, and build a more structured sales process with 10+ years of sales experience.',
    keywords: '',
    ogImageUrl: '',
    canonicalUrl: '',
    allowIndexing: true,
    googleAnalyticsId: '',
  },
  smtp: {
    isEnabled: false,
    host: '',
    port: 587,
    security: 'starttls',
    username: '',
    fromName: 'ProConnect',
    fromEmail: '',
    replyToEmail: '',
  },
};

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isValidTimezone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function validateGeneral(input) {
  const fieldErrors = {};
  const value = {
    siteName: text(input.siteName, 80),
    contactEmail: text(input.contactEmail, 255).toLowerCase(),
    contactPhone: text(input.contactPhone, 32),
    businessAddress: text(input.businessAddress, 300),
    timezone: text(input.timezone, 64) || SETTING_DEFAULTS.general.timezone,
    logoUrl: text(input.logoUrl, 500),
  };
  if (!value.siteName) fieldErrors.siteName = 'Site name is required';
  if (value.contactEmail && !EMAIL_REGEX.test(value.contactEmail)) fieldErrors.contactEmail = 'Enter a valid email';
  if (value.contactPhone && !/^[+\d][\d\s()-]{6,}$/.test(value.contactPhone)) fieldErrors.contactPhone = 'Enter a valid phone number';
  if (!isValidTimezone(value.timezone)) fieldErrors.timezone = 'Unknown timezone (e.g. Asia/Kolkata)';
  if (value.logoUrl && !isValidUrl(value.logoUrl)) fieldErrors.logoUrl = 'Enter a full URL (https://…)';
  return { value, fieldErrors };
}

function validateSeo(input) {
  const fieldErrors = {};
  const value = {
    metaTitle: text(input.metaTitle, 120),
    metaDescription: text(input.metaDescription, 300),
    keywords: text(input.keywords, 500),
    ogImageUrl: text(input.ogImageUrl, 500),
    canonicalUrl: text(input.canonicalUrl, 300).replace(/\/+$/, ''),
    allowIndexing: input.allowIndexing === true,
    googleAnalyticsId: text(input.googleAnalyticsId, 32).toUpperCase(),
  };
  if (!value.metaTitle) fieldErrors.metaTitle = 'Meta title is required';
  if (!value.metaDescription) fieldErrors.metaDescription = 'Meta description is required';
  if (value.ogImageUrl && !isValidUrl(value.ogImageUrl)) fieldErrors.ogImageUrl = 'Enter a full URL (https://…)';
  if (value.canonicalUrl && !isValidUrl(value.canonicalUrl)) fieldErrors.canonicalUrl = 'Enter the full site URL (https://…)';
  if (value.googleAnalyticsId && !GA_ID_REGEX.test(value.googleAnalyticsId)) {
    fieldErrors.googleAnalyticsId = 'Use a measurement ID like G-XXXXXXX';
  }
  return { value, fieldErrors };
}

/**
 * The password is NOT part of the stored document here: the API handles it separately
 * (blank = keep the saved one) and stores it encrypted.
 */
function validateSmtp(input) {
  const fieldErrors = {};
  const port = Number(input.port);
  const value = {
    isEnabled: input.isEnabled === true,
    host: text(input.host, 253).toLowerCase(),
    port: Number.isInteger(port) ? port : 0,
    security: SMTP_SECURITY_OPTIONS.some((o) => o.value === input.security) ? input.security : 'starttls',
    username: text(input.username, 255),
    fromName: text(input.fromName, 120),
    fromEmail: text(input.fromEmail, 255).toLowerCase(),
    replyToEmail: text(input.replyToEmail, 255).toLowerCase(),
  };
  // Required only when sending is switched on, so a half-filled form can still be saved
  if (value.host && !HOSTNAME_REGEX.test(value.host)) fieldErrors.host = 'Enter a hostname such as smtp.gmail.com';
  if (value.isEnabled && !value.host) fieldErrors.host = 'Host is required to send email';
  if (value.port < 1 || value.port > 65535) fieldErrors.port = 'Port must be 1–65535';
  if (value.fromEmail && !EMAIL_REGEX.test(value.fromEmail)) fieldErrors.fromEmail = 'Enter a valid email';
  if (value.isEnabled && !value.fromEmail) fieldErrors.fromEmail = 'From email is required to send email';
  if (value.replyToEmail && !EMAIL_REGEX.test(value.replyToEmail)) fieldErrors.replyToEmail = 'Enter a valid email';
  return { value, fieldErrors };
}

const VALIDATORS = { general: validateGeneral, seo: validateSeo, smtp: validateSmtp };

/**
 * @param {'general' | 'seo' | 'smtp'} settingKey
 * @param {object} input
 * @returns {{ value: object, fieldErrors: Record<string, string> }}
 */
export function validateSetting(settingKey, input) {
  const validator = VALIDATORS[settingKey];
  if (!validator) throw new Error(`Unknown setting "${settingKey}"`);
  return validator(input && typeof input === 'object' ? input : {});
}
