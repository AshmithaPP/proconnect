import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import { getConsultantAccount } from '@/features/auth/portal-user.repository';
import ConsultantAccount from '@/features/auth/components/ConsultantAccount';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Consultant — ProConnect Admin',
  robots: { index: false, follow: false },
};

export default async function ConsultantPage() {
  await requirePortalUser('admin');
  const consultant = await getConsultantAccount();

  return (
    <div className="admin-dashboard-full">
      <div className="portal-page-head">
        <div>
          <h1 className="portal-page-title">Consultant</h1>
          <p className="portal-page-subtitle">The consultant&apos;s sign-in for the consultant portal.</p>
        </div>
      </div>
      <ConsultantAccount consultant={consultant} />
    </div>
  );
}
