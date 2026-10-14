import React from 'react';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listPaidBookings, getBookingStats } from '@/lib/data-access/consultation-bookings';
import { formatAmount } from '@/lib/booking/payment-config';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administrator Dashboard — ProConnect',
  robots: {
    index: false,
    follow: false,
  },
};

const PAGE_SIZE = 20;

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

function withOther(value, otherValue) {
  return value === 'Other' && otherValue ? `Other (${otherValue})` : value || '—';
}

export default async function AdminDashboardPage({ searchParams }) {
  const { admin } = await requireAdmin();
  const resolvedSearchParams = await searchParams;
  const currentPage = Math.max(Number(resolvedSearchParams?.page) || 1, 1);

  const [{ bookings, totalCount }, stats] = await Promise.all([
    listPaidBookings({ page: currentPage, pageSize: PAGE_SIZE }),
    getBookingStats(),
  ]);

  const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1);

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
            Welcome back, <span className="highlight-text">{admin.fullName}</span>
          </h1>
          <p className="dashboard-sub-heading">
            Paid consultation bookings from the website, most recent first.
          </p>
        </div>
      </div>

      {/* Booking KPIs */}
      <div className="admin-kpi-grid">
        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Paid Bookings</span>
            <span className="card-pill-tag tag-green">Confirmed</span>
          </div>
          <div className="card-val">{stats.paidBookingCount}</div>
          <div className="card-subtext">All time</div>
        </div>

        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Paid Today</span>
            <span className="card-pill-tag">Today</span>
          </div>
          <div className="card-val">{stats.paidTodayCount}</div>
          <div className="card-subtext">Since midnight</div>
        </div>

        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Revenue Collected</span>
            <span className="card-pill-tag">INR</span>
          </div>
          <div className="card-val">{formatAmount(stats.totalRevenuePaise)}</div>
          <div className="card-subtext">From paid bookings</div>
        </div>

        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Awaiting Payment</span>
            <span className="card-pill-tag">Pending</span>
          </div>
          <div className="card-val">{stats.pendingPaymentCount}</div>
          <div className="card-subtext">Submitted, not yet paid</div>
        </div>
      </div>

      {/* Paid Bookings Table */}
      <div className="admin-table-card">
        <div className="admin-table-head">
          <h2 className="admin-table-title">Paid Consultation Bookings</h2>
          <span className="card-pill-tag">{totalCount} total</span>
        </div>

        {bookings.length === 0 ? (
          <div className="admin-table-empty">
            No paid bookings yet. Paid bookings submitted from the website will appear here.
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Paid At</th>
                  <th>Client</th>
                  <th>Company</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Team Size</th>
                  <th>Sales Challenge</th>
                  <th>Preferred Slot</th>
                  <th>Amount</th>
                  <th>Booking ID</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.bookingId}>
                    <td className="cell-nowrap">{formatDateTime(booking.payment.paidAt)}</td>
                    <td>
                      <div className="cell-primary">{booking.fullName}</div>
                      <a className="cell-secondary" href={`mailto:${booking.workEmail}`}>
                        {booking.workEmail}
                      </a>
                    </td>
                    <td>{booking.companyName}</td>
                    <td className="cell-nowrap">
                      <a href={`tel:${booking.phoneNumber.replace(/[^+\d]/g, '')}`}>
                        {booking.phoneNumber}
                      </a>
                    </td>
                    <td>{withOther(booking.userRole, booking.userRoleOther)}</td>
                    <td className="cell-nowrap">{booking.salesTeamSize || '—'}</td>
                    <td>{withOther(booking.salesChallenge, booking.salesChallengeOther)}</td>
                    <td className="cell-nowrap">{booking.preferredTimeSlot}</td>
                    <td className="cell-nowrap">
                      <span className="card-pill-tag tag-green">
                        {formatAmount(booking.payment.amountPaise, booking.payment.currencyCode)}
                      </span>
                    </td>
                    <td className="cell-mono" title={booking.bookingId}>
                      {booking.bookingId.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="admin-table-pagination">
            {currentPage > 1 ? (
              <Link href={`/admin/dashboard?page=${currentPage - 1}`}>← Previous</Link>
            ) : (
              <span />
            )}
            <span>
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link href={`/admin/dashboard?page=${currentPage + 1}`}>Next →</Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
