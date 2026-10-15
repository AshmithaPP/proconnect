import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import PaidBookingsPanel from '@/features/booking/components/PaidBookingsPanel';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Consultant Dashboard — ProConnect',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ConsultantDashboardPage({ searchParams }) {
  const { user } = await requirePortalUser('consultant');
  const resolvedSearchParams = await searchParams;

  return (
    <div className="admin-dashboard-full">
      {/* Welcome Banner */}
      <div className="dashboard-hero-banner">
        <div className="banner-text-col">
          <div className="portal-badge-row">
            <span className="live-status-badge">
              <span className="live-status-dot" />
              Session Verified
            </span>
            <span className="badge-sep">•</span>
            <span className="portal-sub-tag">ProConnect Consultant Portal</span>
          </div>
          <h1 className="dashboard-heading">
            Welcome back, <span className="highlight-text">{user.fullName}</span>
          </h1>
          <p className="dashboard-sub-heading">
            Consultations that are successfully paid and booked, most recently paid first.
          </p>
        </div>
      </div>

      <PaidBookingsPanel basePath="/consultant/dashboard" page={resolvedSearchParams?.page} />
    </div>
  );
}
