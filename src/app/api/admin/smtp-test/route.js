import { verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import { validateSetting } from '@/features/settings/settings.definitions';
import { sendSmtpTestEmail } from '@/features/email/mailer';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/admin/smtp-test — admin only
 * Body: { settings: <SMTP form>, password?: string, to: string }
 * Sends a test email with the settings currently in the form (blank password = saved one)
 * and returns the SMTP server's error verbatim if it fails.
 */
export async function POST(request) {
  const auth = await verifyPortalApiRequest(request, 'superadmin');
  if (!auth.authorized) return auth.response;

  const body = await readJsonBody(request);
  if (!body) return jsonNoStore({ error: 'Malformed JSON payload' }, 400);

  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
  if (!EMAIL_REGEX.test(to)) {
    return jsonNoStore({ error: 'Enter a valid recipient email', fieldErrors: { testRecipient: 'Enter a valid email' } }, 400);
  }

  // Validate as if sending were switched on, so host/from are required
  const { value, fieldErrors } = validateSetting('smtp', { ...body.settings, isEnabled: true });
  if (Object.keys(fieldErrors).length) {
    return jsonNoStore({ error: 'Please fix the highlighted fields', fieldErrors }, 400);
  }

  try {
    await sendSmtpTestEmail(value, typeof body.password === 'string' ? body.password : '', to);
    return jsonNoStore({ success: true, message: `Test email sent to ${to}` });
  } catch (err) {
    return jsonNoStore({ error: `SMTP error: ${err.message}` }, 502);
  }
}
