import React from 'react';
import Link from 'next/link';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import { listPortalUsersByRole } from '@/features/auth/portal-user.repository';
import { getPaidBookingStats } from '@/features/booking/booking.repository';
import { getPaymentMode, getWorldlineConfig } from '@/features/payments/payment.config';
import { getBookingRules } from '@/features/schedule/schedule.repository';
import { formatAmount } from '@/features/payments/format-amount';
import AnalyticsDashboard from '@/features/analytics/components/AnalyticsDashboard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Platform Admin — ProConnect',
  robots: {
    index: false,
    follow: false,
  },
};


/**
 * Platform admin overview (our company): platform status, then the consultant's business
 * analytics (the admin has every consultant feature).
 */
export default async function AdminDashboardPage({ searchParams }) {
  const { user } = await requirePortalUser('admin');
  const resolvedSearchParams = await searchParams;

  const [consultants, stats, bookingRules] = await Promise.all([
    listPortalUsersByRole('consultant'),
    getPaidBookingStats(),
    getBookingRules(),
  ]);

  const paymentMode = getPaymentMode();
  const isSandbox = getWorldlineConfig().baseUrl.includes('.preprod.');
  const activeConsultants = consultants.filter((c) => c.accountStatus === 'active').length;

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
            <span className="portal-sub-tag">ProConnect Admin Portal</span>
          </div>
          <h1 className="dashboard-heading">
            Welcome back, <span className="highlight-text">{user.fullName}</span>
          </h1>
          <p className="dashboard-sub-heading">
            Platform status and the consultant's business at a glance.
          </p>
        </div>
      </div>

      {/* Platform KPIs */}
      <div className="admin-kpi-grid">
        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Consultant Accounts</span>
            <span className="card-pill-tag tag-green">Active</span>
          </div>
          <div className="card-val">{activeConsultants}</div>
          <div className="card-subtext">
            {consultants.length} in total · <Link href="/admin/dashboard/consultants">Manage →</Link>
          </div>
        </div>

        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Payment Gateway</span>
            <span className="card-pill-tag">{paymentMode === 'worldline' ? (isSandbox ? 'Sandbox' : 'Live') : 'Off'}</span>
          </div>
          <div className="card-val">{paymentMode === 'worldline' ? 'Worldline' : 'Disabled'}</div>
          <div className="card-subtext">
            {paymentMode === 'worldline' ? (isSandbox ? 'Pre-production test payments' : 'Live payments') : 'PAYMENT_MODE is not set'}
          </div>
        </div>

        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Consultation Fee</span>
            <span className="card-pill-tag">INR</span>
          </div>
          <div className="card-val">{formatAmount(bookingRules.consultationFeePaise)}</div>
          <div className="card-subtext">Per booking · set in Schedule &amp; Pricing</div>
        </div>

        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Paid Bookings</span>
            <span className="card-pill-tag">All time</span>
          </div>
          <div className="card-val">{stats.paidBookingCount}</div>
          <div className="card-subtext">{formatAmount(stats.totalRevenuePaise)} collected</div>
        </div>
      </div>

      {/* Business analytics — the same dashboard the consultant sees */}
      <div className="portal-page-head">
        <div>
          <h2 className="portal-page-title" style={{ fontSize: '1.2rem' }}>Business analytics</h2>
          <p className="portal-page-subtitle">The consultant's dashboard: revenue, bookings, schedule and clients.</p>
        </div>
      </div>
      <AnalyticsDashboard basePath="/admin/dashboard" bookingsPath="/admin/dashboard/bookings" range={resolvedSearchParams?.range} />
    </div>
  );
}
