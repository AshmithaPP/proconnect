import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import { listEmailTemplates } from '@/features/email/email.repository';
import { getSetting } from '@/features/settings/settings.repository';
import EmailTemplatesEditor from '@/features/email/components/EmailTemplatesEditor';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Email Templates — ProConnect Admin',
  robots: { index: false, follow: false },
};

export default async function EmailTemplatesPage() {
  await requirePortalUser('admin');
  const [templates, general] = await Promise.all([listEmailTemplates(), getSetting('general')]);

  return (
    <div className="admin-dashboard-full">
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Email Templates</h1>
          <p className="portal-page-subtitle">The wording of every email the site sends. Sending itself is configured under Settings → SMTP.</p>
        </div>
      </div>
      <EmailTemplatesEditor
        initialTemplates={templates.map(({ updatedAt, ...template }) => template)}
        siteVariables={{ site_name: general.siteName, contact_email: general.contactEmail, contact_phone: general.contactPhone }}
      />
    </div>
  );
}
