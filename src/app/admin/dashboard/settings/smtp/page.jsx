import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import { getSetting } from '@/features/settings/settings.repository';
import { listRecentEmailDeliveries } from '@/features/email/email.repository';
import { EMAIL_TEMPLATES } from '@/features/email/email-templates';
import SmtpSettingsForm from '@/features/settings/components/SmtpSettingsForm';

export const dynamic = 'force-dynamic';

const STATUS_CHIP = { sent: 'ok', failed: 'bad', skipped: 'muted' };

function formatDateTime(value) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

export default async function SmtpSettingsPage() {
  const { user } = await requirePortalUser('admin');
  const [smtp, deliveries] = await Promise.all([getSetting('smtp'), listRecentEmailDeliveries(20)]);

  return (
    <>
      <SmtpSettingsForm initialValue={smtp} adminEmail={user.email} />

      <div className="admin-table-card">
        <div className="admin-table-head">
          <h2 className="admin-table-title">Recent Emails</h2>
          <span className="card-pill-tag">Last {deliveries.length}</span>
        </div>
        {deliveries.length === 0 ? (
          <div className="admin-table-empty">No emails sent yet.</div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Email</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.emailDeliveryId}>
                    <td className="cell-nowrap">{formatDateTime(delivery.createdAt)}</td>
                    <td className="cell-nowrap">{EMAIL_TEMPLATES[delivery.templateKey]?.templateName || delivery.templateKey}</td>
                    <td>{delivery.recipientEmail}</td>
                    <td>{delivery.emailSubject}</td>
                    <td>
                      <span className={`status-chip ${STATUS_CHIP[delivery.deliveryStatus]}`}>{delivery.deliveryStatus}</span>
                      {delivery.errorMessage && <span className="cell-secondary">{delivery.errorMessage}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
