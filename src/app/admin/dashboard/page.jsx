import React from 'react';
import Link from 'next/link';
import { requirePortalUser } from '@/features/auth/require-portal-user';
import { listPortalUsersByRole } from '@/features/auth/portal-user.repository';
import { getPaidBookingStats } from '@/features/booking/booking.repository';
import { getPaymentMode, getWorldlineConfig, getConsultationFee } from '@/features/payments/payment.config';
import { formatAmount } from '@/features/payments/format-amount';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Platform Admin — ProConnect',
  robots: {
    index: false,
    follow: false,
  },
};

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Platform admin overview (our company). Customer bookings are managed in the consultant
 * portal; this page shows platform health and the consultant accounts.
 */
export default async function AdminDashboardPage() {
  const { user } = await requirePortalUser('admin');

  const [consultants, stats] = await Promise.all([listPortalUsersByRole('consultant'), getPaidBookingStats()]);

  const paymentMode = getPaymentMode();
  const isSandbox = getWorldlineConfig().baseUrl.includes('.preprod.');
  const fee = getConsultationFee();
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
            Platform status and consultant accounts. Bookings are managed in the consultant portal.
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
          <div className="card-subtext">{consultants.length} in total</div>
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
          <div className="card-val">{fee.amountPaise ? formatAmount(fee.amountPaise) : 'Not set'}</div>
          <div className="card-subtext">Per booking</div>
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

      {/* Consultant Accounts */}
      <div className="admin-table-card">
        <div className="admin-table-head">
          <h2 className="admin-table-title">Consultant Accounts</h2>
          <Link href="/admin/dashboard/consultants" className="card-pill-tag">Manage →</Link>
        </div>

        {consultants.length === 0 ? (
          <div className="admin-table-empty">
            No consultant account yet. <Link href="/admin/dashboard/consultants">Create one</Link>.
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {consultants.map((consultant) => (
                  <tr key={consultant.portalUserId}>
                    <td className="cell-primary">{consultant.fullName}</td>
                    <td>
                      <a href={`mailto:${consultant.email}`}>{consultant.email}</a>
                    </td>
                    <td className="cell-nowrap">{consultant.accountStatus === 'active' ? 'Active' : 'Inactive'}</td>
                    <td className="cell-nowrap">{formatDateTime(consultant.createdAt)}</td>
                    <td className="cell-nowrap">{formatDateTime(consultant.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
