import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import AnalyticsDashboard from '@/features/analytics/components/AnalyticsDashboard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin Dashboard — ProConnect',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminDashboardPage({ searchParams }) {
  const { user } = await requirePortalUser('admin');
  const resolvedSearchParams = await searchParams;

  return (
    <div className="admin-dashboard-full">
      {/* Welcome Banner */}
      <div className="dashboard-hero-banner">
        <div className="banner-text-col">
          <div className="portal-badge-row">
            <span className="portal-sub-tag">ProConnect Admin Portal</span>
          </div>
          <h1 className="dashboard-heading">
            Welcome back, <span className="highlight-text">{user.fullName}</span>
          </h1>
          <p className="dashboard-sub-heading">Your bookings, revenue and schedule at a glance.</p>
        </div>
      </div>

      <AnalyticsDashboard
        basePath="/admin/dashboard"
        bookingsPath="/admin/dashboard/bookings"
        range={resolvedSearchParams?.range}
      />
    </div>
  );
}
