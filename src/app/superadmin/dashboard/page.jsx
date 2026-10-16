import React from 'react';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import AnalyticsDashboard from '@/features/analytics/components/AnalyticsDashboard';
import SuperAdminOverviewCards from '@/features/analytics/components/SuperAdminOverviewCards';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Super Admin Dashboard — ProConnect',
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Super Admin Dashboard:
 * 100% dynamic API-driven architecture.
 * - Platform KPIs fetched dynamically from GET /api/superadmin/overview
 * - Business analytics & charts fetched dynamically from GET /api/superadmin/analytics
 */
export default async function SuperAdminDashboardPage({ searchParams }) {
  const { user } = await requirePortalUser('superadmin');
  const resolvedSearchParams = await searchParams;

  return (
    <div className="admin-dashboard-full">
      {/* Welcome Banner */}
      <div className="dashboard-hero-banner">
        <div className="banner-text-col">
          <div className="portal-badge-row">
            <span className="portal-sub-tag">ProConnect Super Admin Portal</span>
          </div>
          <h1 className="dashboard-heading">
            Welcome back, <span className="highlight-text">{user.fullName}</span>
          </h1>
          <p className="dashboard-sub-heading">Platform status and business analytics.</p>
        </div>
      </div>

      {/* Dynamic Platform KPIs (Loaded from /api/superadmin/overview) */}
      <SuperAdminOverviewCards />

      {/* Business Analytics (Loaded dynamically from /api/superadmin/analytics) */}
      <div className="portal-page-head" style={{ marginTop: 28 }}>
        <div>
          <h2 className="portal-page-title" style={{ fontSize: '1.2rem' }}>Business Analytics</h2>
          <p className="portal-page-subtitle">Revenue, bookings, schedule utilization and client breakdowns.</p>
        </div>
      </div>
      <AnalyticsDashboard
        basePath="/superadmin/dashboard"
        bookingsPath="/superadmin/dashboard/bookings"
        range={resolvedSearchParams?.range}
      />
    </div>
  );
}
