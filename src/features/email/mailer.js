import 'server-only';
import nodemailer from 'nodemailer';
import { getSetting, getSmtpCredentials } from '@/features/settings/settings.repository';
import { getEmailTemplate, logEmailDelivery } from '@/features/email/email.repository';
import { renderTemplateText, wrapEmailLayout } from '@/features/email/email-templates';

const TIMEOUT_MS = 15000;

/**
 * @param {object} smtp - SMTP settings incl. password
 */
function createTransport(smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port),
    secure: smtp.security === 'ssl',
    requireTLS: smtp.security === 'starttls',
    ignoreTLS: smtp.security === 'none',
    auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}

function fromAddress(smtp) {
  return smtp.fromName ? { name: smtp.fromName, address: smtp.fromEmail } : smtp.fromEmail;
}

/** Variables every template can use */
async function getSiteVariables() {
  const general = await getSetting('general');
  return {
    site_name: general.siteName,
    contact_email: general.contactEmail,
    contact_phone: general.contactPhone,
  };
}

/**
 * Renders a template and sends it with the saved SMTP settings. Never throws: a missing or
 * disabled SMTP setup is logged as "skipped", a delivery error as "failed" — sending email
 * must never break a booking or payment.
 *
 * @param {{ templateKey: string, to: string, variables: Record<string, string>, bookingId?: string }} params
 * @returns {Promise<{ deliveryStatus: 'sent'|'failed'|'skipped', errorMessage?: string }>}
 */
export async function sendTemplatedEmail({ templateKey, to, variables, bookingId }) {
  let emailSubject = templateKey;
  try {
    const [template, siteVariables, smtp] = await Promise.all([
      getEmailTemplate(templateKey),
      getSiteVariables(),
      getSmtpCredentials(),
    ]);
    const allVariables = { ...siteVariables, ...variables };
    emailSubject = renderTemplateText(template.emailSubject, allVariables, { html: false });

    const skipReason = !smtp.isEnabled
      ? 'SMTP sending is switched off'
      : !smtp.host || !smtp.fromEmail
        ? 'SMTP is not configured'
        : !template.isEnabled
          ? 'Template is disabled'
          : null;
    if (skipReason) {
      await logEmailDelivery({ templateKey, recipientEmail: to, emailSubject, deliveryStatus: 'skipped', errorMessage: skipReason, bookingId });
      return { deliveryStatus: 'skipped', errorMessage: skipReason };
    }

    const html = wrapEmailLayout(renderTemplateText(template.bodyHtml, allVariables, { html: true }), allVariables);
    const info = await createTransport(smtp).sendMail({
      from: fromAddress(smtp),
      replyTo: smtp.replyToEmail || undefined,
      to,
      subject: emailSubject,
      html,
    });
    await logEmailDelivery({ templateKey, recipientEmail: to, emailSubject, deliveryStatus: 'sent', providerMessageId: info.messageId, bookingId });
    return { deliveryStatus: 'sent' };
  } catch (err) {
    console.error(`[Email] "${templateKey}" to ${to} failed:`, err.message);
    await logEmailDelivery({ templateKey, recipientEmail: to, emailSubject, deliveryStatus: 'failed', errorMessage: err.message, bookingId });
    return { deliveryStatus: 'failed', errorMessage: err.message };
  }
}

/**
 * "Send test email" on the SMTP page. Uses the settings currently in the form (so they can be
 * tried before saving); a blank password falls back to the saved one. Throws the SMTP error
 * so the admin sees exactly what went wrong.
 *
 * @param {object} smtpForm - validated SMTP settings from the form
 * @param {string} formPassword - password typed in the form ('' = use saved)
 * @param {string} to
 */
export async function sendSmtpTestEmail(smtpForm, formPassword, to) {
  const saved = await getSmtpCredentials();
  const smtp = { ...smtpForm, password: formPassword || saved.password };
  if (!smtp.host || !smtp.fromEmail) {
    throw new Error('Host and From email are required');
  }

  const [template, siteVariables] = await Promise.all([getEmailTemplate('smtp_test'), getSiteVariables()]);
  const variables = {
    ...siteVariables,
    sent_at: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }),
  };
  const emailSubject = renderTemplateText(template.emailSubject, variables, { html: false });

  try {
    const transport = createTransport(smtp);
    await transport.verify();
    const info = await transport.sendMail({
      from: fromAddress(smtp),
      replyTo: smtp.replyToEmail || undefined,
      to,
      subject: emailSubject,
      html: wrapEmailLayout(renderTemplateText(template.bodyHtml, variables, { html: true }), variables),
    });
    await logEmailDelivery({ templateKey: 'smtp_test', recipientEmail: to, emailSubject, deliveryStatus: 'sent', providerMessageId: info.messageId });
  } catch (err) {
    await logEmailDelivery({ templateKey: 'smtp_test', recipientEmail: to, emailSubject, deliveryStatus: 'failed', errorMessage: err.message });
    throw err;
  }
}
