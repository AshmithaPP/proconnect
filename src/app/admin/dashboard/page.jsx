import React from 'react';
import Link from 'next/link';
import { requireAdmin } from '@/features/auth/require-admin';
import { listBookings, getBookingStats } from '@/features/booking/booking.repository';
import { formatAmount } from '@/features/payments/format-amount';

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

const STATUS_META = {
  paid: { label: 'Paid', className: 'status-paid' },
  pending: { label: 'Awaiting payment', className: 'status-pending' },
  cancelled: { label: 'Cancelled', className: 'status-cancelled' },
  no_payment: { label: 'No payment record', className: 'status-missing' },
};

function dashboardHref(status, page = 1) {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/admin/dashboard?${qs}` : '/admin/dashboard';
}

export default async function AdminDashboardPage({ searchParams }) {
  const { admin } = await requireAdmin();
  const resolvedSearchParams = await searchParams;
  const currentPage = Math.max(Number(resolvedSearchParams?.page) || 1, 1);

  const [{ bookings, totalCount, status: activeStatus }, stats] = await Promise.all([
    listBookings({ status: resolvedSearchParams?.status || 'all', page: currentPage, pageSize: PAGE_SIZE }),
    getBookingStats(),
  ]);

  const filterTabs = [
    { status: 'all', label: 'All', count: stats.totalBookingCount },
    { status: 'paid', label: 'Paid', count: stats.paidBookingCount },
    { status: 'pending', label: 'Awaiting payment', count: stats.pendingPaymentCount },
    { status: 'cancelled', label: 'Cancelled', count: stats.cancelledCount },
    ...(stats.noPaymentCount > 0
      ? [{ status: 'no_payment', label: 'No payment record', count: stats.noPaymentCount }]
      : []),
  ];

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
            Every consultation booking from the website with its payment status, newest first.
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
          <h2 className="admin-table-title">Consultation Bookings</h2>
          <span className="card-pill-tag">{totalCount} total</span>
        </div>

        <nav className="admin-filter-tabs" aria-label="Filter bookings by status">
          {filterTabs.map((tab) => (
            <Link
              key={tab.status}
              href={dashboardHref(tab.status)}
              className={`admin-filter-tab ${activeStatus === tab.status ? 'active' : ''}`}
            >
              {tab.label}
              <span className="admin-filter-count">{tab.count}</span>
            </Link>
          ))}
        </nav>

        {bookings.length === 0 ? (
          <div className="admin-table-empty">
            No bookings in this view yet.
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Booked At</th>
                  <th>Client</th>
                  <th>Company</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Team Size</th>
                  <th>Sales Challenge</th>
                  <th>Preferred Slot</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Booking ID</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.bookingId}>
                    <td className="cell-nowrap">
                      {formatDateTime(booking.bookedAt)}
                      {booking.payment?.paidAt && (
                        <span className="cell-secondary">Paid {formatDateTime(booking.payment.paidAt)}</span>
                      )}
                    </td>
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
                      {booking.payment
                        ? formatAmount(booking.payment.amountPaise, booking.payment.currencyCode)
                        : '—'}
                    </td>
                    <td className="cell-nowrap">
                      <span className={`status-badge ${STATUS_META[booking.status].className}`}>
                        {STATUS_META[booking.status].label}
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
              <Link href={dashboardHref(activeStatus, currentPage - 1)}>← Previous</Link>
            ) : (
              <span />
            )}
            <span>
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link href={dashboardHref(activeStatus, currentPage + 1)}>Next →</Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
