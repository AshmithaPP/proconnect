import 'server-only';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { EMAIL_TEMPLATES } from '@/features/email/email-templates';

/**
 * A template as the app uses it: the admin's saved version, or the default from code.
 * @param {string} templateKey
 */
export async function getEmailTemplate(templateKey) {
  const definition = EMAIL_TEMPLATES[templateKey];
  if (!definition) throw new Error(`Unknown email template "${templateKey}"`);

  const rows = await query(
    `SELECT email_subject, body_html, is_enabled, updated_at FROM email_templates WHERE template_key = ? LIMIT 1`,
    [templateKey]
  );
  const saved = rows[0];
  return {
    templateKey,
    templateName: definition.templateName,
    description: definition.description,
    recipientLabel: definition.recipientLabel,
    variables: definition.variables,
    emailSubject: saved ? saved.email_subject : definition.defaultSubject,
    bodyHtml: saved ? saved.body_html : definition.defaultBodyHtml,
    isEnabled: saved ? Boolean(saved.is_enabled) : true,
    isCustomized: Boolean(saved),
    updatedAt: saved?.updated_at || null,
  };
}

export async function listEmailTemplates() {
  return Promise.all(Object.keys(EMAIL_TEMPLATES).map(getEmailTemplate));
}

/**
 * @param {string} templateKey
 * @param {{ emailSubject: string, bodyHtml: string, isEnabled: boolean }} template
 * @param {string} updatedByUserId
 */
export async function saveEmailTemplate(templateKey, { emailSubject, bodyHtml, isEnabled }, updatedByUserId) {
  await query(
    `INSERT INTO email_templates (template_key, email_subject, body_html, is_enabled, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE email_subject = VALUES(email_subject), body_html = VALUES(body_html),
       is_enabled = VALUES(is_enabled), updated_by_user_id = VALUES(updated_by_user_id)`,
    [templateKey, emailSubject, bodyHtml, isEnabled ? 1 : 0, updatedByUserId || null]
  );
}

/** Back to the default wording from code */
export async function resetEmailTemplate(templateKey) {
  await query(`DELETE FROM email_templates WHERE template_key = ?`, [templateKey]);
}

/**
 * @param {{ templateKey: string, recipientEmail: string, emailSubject: string,
 *   deliveryStatus: 'sent'|'failed'|'skipped', errorMessage?: string,
 *   providerMessageId?: string, bookingId?: string }} delivery
 */
export async function logEmailDelivery(delivery) {
  try {
    await query(
      `INSERT INTO email_deliveries
         (email_delivery_id, template_key, recipient_email, email_subject, delivery_status, error_message, provider_message_id, booking_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        delivery.templateKey,
        delivery.recipientEmail.slice(0, 255),
        delivery.emailSubject.slice(0, 255),
        delivery.deliveryStatus,
        delivery.errorMessage ? delivery.errorMessage.slice(0, 500) : null,
        delivery.providerMessageId ? delivery.providerMessageId.slice(0, 255) : null,
        delivery.bookingId || null,
      ]
    );
  } catch (err) {
    console.error('[Email] Could not log delivery:', err.message);
  }
}

/** Most recent deliveries for the admin SMTP page */
export async function listRecentEmailDeliveries(limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const rows = await query(
    `SELECT email_delivery_id, template_key, recipient_email, email_subject, delivery_status, error_message, created_at
     FROM email_deliveries ORDER BY created_at DESC LIMIT ${safeLimit}`
  );
  return rows.map((row) => ({
    emailDeliveryId: row.email_delivery_id,
    templateKey: row.template_key,
    recipientEmail: row.recipient_email,
    emailSubject: row.email_subject,
    deliveryStatus: row.delivery_status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}
