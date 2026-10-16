import { verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import { EMAIL_TEMPLATES } from '@/features/email/email-templates';
import { getEmailTemplate, saveEmailTemplate, resetEmailTemplate } from '@/features/email/email.repository';

/**
 * PUT    /api/admin/email-templates/{templateKey} — save subject, body, enabled
 * DELETE /api/admin/email-templates/{templateKey} — reset to the default wording
 * Admin only.
 */
async function resolveKey(params) {
  const { templateKey } = await params;
  return Object.hasOwn(EMAIL_TEMPLATES, templateKey) ? templateKey : null;
}

export async function PUT(request, { params }) {
  const auth = await verifyPortalApiRequest(request, 'superadmin');
  if (!auth.authorized) return auth.response;

  const templateKey = await resolveKey(params);
  if (!templateKey) return jsonNoStore({ error: 'Unknown template' }, 404);

  const body = await readJsonBody(request);
  if (!body) return jsonNoStore({ error: 'Malformed JSON payload' }, 400);

  const emailSubject = typeof body.emailSubject === 'string' ? body.emailSubject.trim() : '';
  const bodyHtml = typeof body.bodyHtml === 'string' ? body.bodyHtml.trim() : '';
  const fieldErrors = {};
  if (!emailSubject) fieldErrors.emailSubject = 'Subject is required';
  if (emailSubject.length > 255) fieldErrors.emailSubject = 'Subject must be at most 255 characters';
  if (!bodyHtml) fieldErrors.bodyHtml = 'Body is required';
  if (bodyHtml.length > 100000) fieldErrors.bodyHtml = 'Body is too long';
  if (Object.keys(fieldErrors).length) {
    return jsonNoStore({ error: 'Please fix the highlighted fields', fieldErrors }, 400);
  }

  try {
    await saveEmailTemplate(templateKey, { emailSubject, bodyHtml, isEnabled: body.isEnabled !== false }, auth.user.portalUserId);
    return jsonNoStore({ success: true, template: await getEmailTemplate(templateKey) });
  } catch (err) {
    console.error('Email template save error:', err.message);
    return jsonNoStore({ error: 'Could not save template' }, 500);
  }
}

export async function DELETE(request, { params }) {
  const auth = await verifyPortalApiRequest(request, 'superadmin');
  if (!auth.authorized) return auth.response;

  const templateKey = await resolveKey(params);
  if (!templateKey) return jsonNoStore({ error: 'Unknown template' }, 404);

  try {
    await resetEmailTemplate(templateKey);
    return jsonNoStore({ success: true, template: await getEmailTemplate(templateKey) });
  } catch (err) {
    console.error('Email template reset error:', err.message);
    return jsonNoStore({ error: 'Could not reset template' }, 500);
  }
}
