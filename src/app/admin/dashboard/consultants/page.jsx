import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import { listPortalUsersByRole } from '@/features/auth/portal-user.repository';
import ConsultantsManager from '@/features/auth/components/ConsultantsManager';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Consultants — ProConnect Admin',
  robots: { index: false, follow: false },
};

export default async function ConsultantsPage() {
  await requirePortalUser('admin');
  const consultants = await listPortalUsersByRole('consultant');

  return (
    <div className="admin-dashboard-full">
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Consultants</h1>
          <p className="portal-page-subtitle">Accounts that can sign in to the consultant portal (one shared booking calendar).</p>
        </div>
      </div>
      <ConsultantsManager consultants={consultants} />
    </div>
  );
}
