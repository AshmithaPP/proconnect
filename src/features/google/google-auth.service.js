import 'server-only';
import { google } from 'googleapis';
import { encryptSecret, decryptSecret } from '@/lib/security/secret-box';
import { readStoredSetting, writeSetting } from '@/features/settings/settings.repository';

const SETTING_KEY = 'google_calendar';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Returns OAuth2 client configuration.
 * Client ID & Secret can come from environment variables or custom overrides in site_settings.
 */
export async function getGoogleOAuthConfig() {
  const stored = await readStoredSetting(SETTING_KEY);
  const clientId = stored.customClientId || process.env.GOOGLE_CLIENT_ID || '';
  const appBase = process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
    : '';
  const defaultRedirect = appBase ? `${appBase}/api/google/oauth/callback` : 'http://localhost:3000/api/google/oauth/callback';
  const redirectUri = stored.customRedirectUri || process.env.GOOGLE_REDIRECT_URI || defaultRedirect;

  return {
    isConfigured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri,
  };
}

/**
 * Creates an unauthenticated OAuth2 client.
 */
export async function createOAuth2Client() {
  const config = await getGoogleOAuthConfig();
  if (!config.isConfigured) {
    throw new Error('Google OAuth credentials are not configured in .env.local or settings.');
  }
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

/**
 * Generates the Google OAuth 2.0 authorization URL.
 * Includes offline access and prompt=consent to ensure a refresh token is returned.
 * @param {string} state - Cryptographically random CSRF state
 */
export async function generateGoogleAuthUrl(state) {
  const oauth2Client = await createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    include_granted_scopes: true,
    state,
  });
}

const CUSTOMER_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Generates Google OAuth URL for customer 1-click booking sign-in.
 * Only requests identity and email without calendar management permissions.
 * @param {string} state - Cryptographically random CSRF state
 */
export async function generateCustomerGoogleAuthUrl(state) {
  const oauth2Client = await createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    scope: CUSTOMER_SCOPES,
    state,
  });
}

/**
 * Exchanges customer authorization code for Google profile data.
 * @param {string} code
 * @returns {Promise<{ email: string, fullName: string, picture: string, googleId: string, verified: boolean }>}
 */
export async function handleCustomerGoogleOAuthCallback(code) {
  const oauth2Client = await createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const data = userInfo.data;

  if (!data.email) {
    throw new Error('Google did not return an email address.');
  }

  return {
    email: data.email.toLowerCase().trim(),
    fullName: data.name || '',
    picture: data.picture || '',
    googleId: data.id || '',
    verified: true,
  };
}

/**
 * Exchanges the authorization code received from Google for tokens and saves them.
 * @param {string} code
 * @param {string|null} updatedByUserId
 */
export async function handleGoogleOAuthCallback(code, updatedByUserId = null) {
  const oauth2Client = await createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  const grantedScope = tokens.scope || '';
  const hasCalendarScope =
    grantedScope.includes('auth/calendar') ||
    grantedScope.includes('auth/calendar.events');

  if (!hasCalendarScope) {
    throw new Error(
      'Calendar permission was not granted. When Google prompts "Select what PreConnect can access", please make sure to check the box for Google Calendar.'
    );
  }

  if (!tokens.refresh_token) {
    // Check if we already have a stored refresh token from a previous approval
    const existing = await readStoredSetting(SETTING_KEY);
    if (!existing.encryptedRefreshToken) {
      throw new Error('Google did not return a refresh token. Please revoke access in your Google Account permissions and try again.');
    }
  }

  oauth2Client.setCredentials(tokens);

  // Retrieve user's email address
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email || 'connected-account';

  const existing = await readStoredSetting(SETTING_KEY);
  const encryptedRefreshToken = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : existing.encryptedRefreshToken;

  const document = {
    ...existing,
    accountEmail: email,
    encryptedRefreshToken,
    connectedAt: new Date().toISOString(),
    scopes: tokens.scope || existing.scopes,
  };

  await writeSetting(SETTING_KEY, document, updatedByUserId);
  return { success: true, email };
}

/**
 * Returns an authenticated Google Calendar client that automatically refreshes access tokens.
 * @returns {Promise<google.calendar_v3.Calendar | null>}
 */
export async function getAuthenticatedCalendarClient() {
  const stored = await readStoredSetting(SETTING_KEY);
  if (!stored.encryptedRefreshToken) return null;

  let refreshToken;
  try {
    refreshToken = decryptSecret(stored.encryptedRefreshToken);
  } catch (err) {
    console.error('[Google Auth] Could not decrypt stored refresh token:', err.message);
    return null;
  }

  const oauth2Client = await createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Returns the current Google Calendar connection status for the admin portal.
 */
export async function getGoogleConnectionStatus() {
  const config = await getGoogleOAuthConfig();
  const stored = await readStoredSetting(SETTING_KEY);
  const isConnected = Boolean(stored.encryptedRefreshToken && stored.accountEmail);

  return {
    isConfigured: config.isConfigured,
    clientIdConfigured: Boolean(config.clientId),
    isConnected,
    accountEmail: stored.accountEmail || null,
    connectedAt: stored.connectedAt || null,
  };
}

/**
 * Disconnects the Google account and clears stored tokens.
 * @param {string|null} updatedByUserId
 */
export async function disconnectGoogleAccount(updatedByUserId = null) {
  const stored = await readStoredSetting(SETTING_KEY);
  if (stored.encryptedRefreshToken) {
    try {
      const refreshToken = decryptSecret(stored.encryptedRefreshToken);
      const oauth2Client = await createOAuth2Client();
      await oauth2Client.revokeToken(refreshToken).catch(() => {});
    } catch {
      // Ignore revocation error if token was already revoked
    }
  }

  const document = {
    customClientId: stored.customClientId || undefined,
    customClientSecret: stored.customClientSecret || undefined,
    customRedirectUri: stored.customRedirectUri || undefined,
  };

  await writeSetting(SETTING_KEY, document, updatedByUserId);
  return { success: true };
}
