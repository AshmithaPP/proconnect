/**
 * Email templates the app sends. Client-safe: the admin editor uses the same definitions
 * and renderer for its live preview.
 *
 * Default wording lives here; an admin edit is stored in `email_templates` and overrides it
 * ("Reset to default" deletes the row). Placeholders: {{variable_name}} — values are
 * HTML-escaped in the body, so customer-entered text can never inject markup.
 */

const SITE_VARIABLES = ['site_name', 'contact_email', 'contact_phone'];

export const EMAIL_TEMPLATES = {
  booking_confirmed_customer: {
    templateName: 'Booking confirmed — to customer',
    description: 'Sent to the customer as soon as Worldline confirms their payment.',
    recipientLabel: 'Customer',
    variables: ['client_name', 'company_name', 'slot_time', 'google_meet_link', 'amount', 'booking_reference', 'payment_id', 'reschedule_link', ...SITE_VARIABLES],
    defaultSubject: 'Your consultation is confirmed — {{slot_time}}',
    defaultBodyHtml: `<p>Hi {{client_name}},</p>
<p>Thank you for booking a sales strategy consultation. Your payment was received and your slot is confirmed.</p>
<table>
  <tr><td><strong>Time</strong></td><td>{{slot_time}}</td></tr>
  <tr><td><strong>Meeting link</strong></td><td><a href="{{google_meet_link}}" style="background:#002D62;color:#ffffff;padding:8px 14px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Join with Google Meet</a></td></tr>
  <tr><td><strong>Amount paid</strong></td><td>{{amount}}</td></tr>
  <tr><td><strong>Booking reference</strong></td><td>{{booking_reference}}</td></tr>
  <tr><td><strong>Payment ID</strong></td><td>{{payment_id}}</td></tr>
</table>
<p>We look forward to speaking with you. A calendar invitation has also been sent to your email. For anything else, reply to this email or contact us at {{contact_email}}.</p>
<p>— {{site_name}}</p>`,
  },
  booking_notification_consultant: {
    templateName: 'New booking — to consultant',
    description: 'Sent to the consultant when a booking is paid.',
    recipientLabel: 'Consultant',
    variables: [
      'client_name', 'company_name', 'client_email', 'client_phone', 'client_role', 'team_size',
      'sales_challenge', 'slot_time', 'google_meet_link', 'amount', 'booking_reference', 'payment_id', ...SITE_VARIABLES,
    ],
    defaultSubject: 'New paid booking: {{client_name}} ({{company_name}}) — {{slot_time}}',
    defaultBodyHtml: `<p>A new consultation has been booked and paid.</p>
<table>
  <tr><td><strong>Client</strong></td><td>{{client_name}} — {{company_name}}</td></tr>
  <tr><td><strong>Email</strong></td><td>{{client_email}}</td></tr>
  <tr><td><strong>Phone</strong></td><td>{{client_phone}}</td></tr>
  <tr><td><strong>Meeting link</strong></td><td><a href="{{google_meet_link}}">{{google_meet_link}}</a></td></tr>
  <tr><td><strong>Role</strong></td><td>{{client_role}}</td></tr>
  <tr><td><strong>Team size</strong></td><td>{{team_size}}</td></tr>
  <tr><td><strong>Sales challenge</strong></td><td>{{sales_challenge}}</td></tr>
  <tr><td><strong>Time</strong></td><td>{{slot_time}}</td></tr>
  <tr><td><strong>Amount</strong></td><td>{{amount}}</td></tr>
  <tr><td><strong>Booking reference</strong></td><td>{{booking_reference}}</td></tr>
  <tr><td><strong>Payment ID</strong></td><td>{{payment_id}}</td></tr>
</table>`,
  },
  booking_rescheduled_customer: {
    templateName: 'Time changed — to customer',
    description:
      'Sent when a booking moves to a new time: automatically (slot taken) or because the customer chose another time.',
    recipientLabel: 'Customer',
    variables: ['client_name', 'previous_slot_time', 'slot_time', 'google_meet_link', 'reschedule_reason', 'booking_reference', 'amount', 'reschedule_link', ...SITE_VARIABLES],
    defaultSubject: 'Your consultation time: {{slot_time}}',
    defaultBodyHtml: `<p>Hi {{client_name}},</p>
<p>{{reschedule_reason}}</p>
<table>
  <tr><td><strong>New time</strong></td><td>{{slot_time}}</td></tr>
  <tr><td><strong>Previous time</strong></td><td><s>{{previous_slot_time}}</s></td></tr>
  <tr><td><strong>Booking reference</strong></td><td>{{booking_reference}}</td></tr>
  <tr><td><strong>Amount paid</strong></td><td>{{amount}}</td></tr>
</table>
<p>Your payment is safe and nothing else is needed from you. If this time doesn't suit you, <a href="{{reschedule_link}}">choose another time</a>.</p>
<p>— {{site_name}}</p>`,
  },
  booking_rescheduled_consultant: {
    templateName: 'Time changed — to consultant',
    description: 'Sent to the consultant when a booking moves to a new time.',
    recipientLabel: 'Consultant',
    variables: [
      'client_name', 'company_name', 'client_email', 'client_phone', 'previous_slot_time', 'slot_time',
      'reschedule_reason', 'booking_reference', ...SITE_VARIABLES,
    ],
    defaultSubject: 'Booking moved: {{client_name}} → {{slot_time}}',
    defaultBodyHtml: `<p>A consultation has moved to a new time.</p>
<table>
  <tr><td><strong>Client</strong></td><td>{{client_name}} — {{company_name}}</td></tr>
  <tr><td><strong>New time</strong></td><td>{{slot_time}}</td></tr>
  <tr><td><strong>Previous time</strong></td><td><s>{{previous_slot_time}}</s></td></tr>
  <tr><td><strong>Why</strong></td><td>{{reschedule_reason}}</td></tr>
  <tr><td><strong>Email / phone</strong></td><td>{{client_email}} · {{client_phone}}</td></tr>
  <tr><td><strong>Booking reference</strong></td><td>{{booking_reference}}</td></tr>
</table>`,
  },
  booking_reschedule_pending_customer: {
    templateName: 'No free time yet — to customer',
    description:
      'Rare: a paid booking must move but no slot is free in the next 30 days. It is moved automatically as soon as one opens.',
    recipientLabel: 'Customer',
    variables: ['client_name', 'previous_slot_time', 'booking_reference', 'amount', ...SITE_VARIABLES],
    defaultSubject: 'About your consultation ({{booking_reference}})',
    defaultBodyHtml: `<p>Hi {{client_name}},</p>
<p>Your payment of {{amount}} was received, but the time you chose ({{previous_slot_time}}) is no longer available and there is no free slot in the coming weeks yet.</p>
<p>Your payment is safe. As soon as a slot opens we will book it for you and email you the new time. You can also reply to this email or contact us at {{contact_email}}.</p>
<p>— {{site_name}}</p>`,
  },
  booking_reschedule_pending_consultant: {
    templateName: 'No free time yet — to consultant',
    description: 'Sent to the consultant when a paid booking could not be moved automatically because no slot is free in the next 30 days.',
    recipientLabel: 'Consultant',
    variables: ['client_name', 'company_name', 'client_email', 'client_phone', 'previous_slot_time', 'booking_reference', ...SITE_VARIABLES],
    defaultSubject: 'Action: no free slot for {{client_name}} ({{booking_reference}})',
    defaultBodyHtml: `<p>A paid booking needs a new time, but no slot is free in the next 30 days.</p>
<table>
  <tr><td><strong>Client</strong></td><td>{{client_name}} — {{company_name}}</td></tr>
  <tr><td><strong>Original time</strong></td><td>{{previous_slot_time}}</td></tr>
  <tr><td><strong>Email / phone</strong></td><td>{{client_email}} · {{client_phone}}</td></tr>
</table>
<p>Open some availability (or reopen blocked days) and it will be booked automatically.</p>`,
  },
  smtp_test: {
    templateName: 'SMTP test',
    description: 'Sent by the "Send test email" button on the SMTP settings page.',
    recipientLabel: 'Admin',
    variables: ['sent_at', ...SITE_VARIABLES],
    defaultSubject: '{{site_name}} — SMTP test email',
    defaultBodyHtml: `<p>This is a test email from {{site_name}}.</p>
<p>If you can read this, your SMTP settings work. Sent at {{sent_at}}.</p>`,
  },
};

/** Example values for the editor preview */
export const SAMPLE_VARIABLES = {
  client_name: 'Priya Sharma',
  company_name: 'Acme Corp',
  client_email: 'priya@acme.com',
  client_phone: '+91 98765 43210',
  client_role: 'Sales Manager / Head',
  team_size: '6–10 people',
  sales_challenge: 'Low lead conversion',
  slot_time: 'Fri, 16 Oct 2026, 10:30 AM – 11:00 AM',
  amount: '₹999.00 INR',
  booking_reference: '4A48CF25',
  payment_id: '900000051410000000700000100001',
  sent_at: '15 Oct 2026, 11:30 am',
  previous_slot_time: 'Thu, 15 Oct 2026, 10:30 AM – 11:00 AM',
  reschedule_reason: 'Another client paid for your chosen time a moment before you, so we booked the next free slot for you.',
  reschedule_link: 'https://example.com/booking/reschedule?token=example',
  site_name: 'ProConnect',
  contact_email: 'hello@example.com',
  contact_phone: '+91 90000 00000',
};

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {string} template
 * @param {Record<string, string>} variables
 * @param {{ html: boolean }} options - html: escape values for an HTML body; otherwise plain text
 */
export function renderTemplateText(template, variables, { html }) {
  return String(template || '').replace(PLACEHOLDER, (_, name) => {
    const value = variables[name] ?? '';
    return html ? escapeHtml(value) : String(value).replace(/[\r\n]+/g, ' ');
  });
}

/**
 * Wraps a rendered body in the shared email layout (header with site name, contact footer).
 * @param {string} bodyHtml - already rendered
 * @param {Record<string, string>} variables
 */
export function wrapEmailLayout(bodyHtml, variables) {
  const contact = [variables.contact_email, variables.contact_phone].filter(Boolean).map(escapeHtml).join(' · ');
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ece7df;">
    <div style="padding:18px 24px;background:#141414;color:#ffffff;font-weight:bold;font-size:18px;">${escapeHtml(variables.site_name)}</div>
    <div style="padding:24px;font-size:15px;line-height:1.6;">${bodyHtml}</div>
    ${contact ? `<div style="padding:14px 24px;border-top:1px solid #ece7df;font-size:12px;color:#777;">${contact}</div>` : ''}
  </div>
</body></html>`;
}
