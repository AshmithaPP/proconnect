import { verifyPortalApiSession, jsonNoStore } from '@/features/auth/api-guard';
import { listEmailTemplates } from '@/features/email/email.repository';

/** GET /api/admin/email-templates — admin only: every template (saved or default wording) */
export async function GET() {
  const auth = await verifyPortalApiSession('superadmin');
  if (!auth.authorized) return auth.response;

  try {
    return jsonNoStore({ templates: await listEmailTemplates() });
  } catch (err) {
    console.error('Email templates list error:', err.message);
    return jsonNoStore({ error: 'Could not load email templates' }, 500);
  }
}
