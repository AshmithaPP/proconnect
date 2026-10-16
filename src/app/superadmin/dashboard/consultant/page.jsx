import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import { getConsultantAccount } from '@/features/auth/portal-user.repository';
import ConsultantAccount from '@/features/auth/components/ConsultantAccount';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin Account — ProConnect Super Admin',
  robots: { index: false, follow: false },
};

export default async function ConsultantPage() {
  await requirePortalUser('superadmin');
  const consultant = await getConsultantAccount();

  return (
    <div className="admin-dashboard-full">
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Admin Account</h1>
          <p className="portal-page-subtitle">The administrator&apos;s sign-in for the admin portal.</p>
        </div>
      </div>
      <ConsultantAccount consultant={consultant} />
    </div>
  );
}
