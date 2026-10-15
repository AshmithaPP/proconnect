import React from 'react';
import Link from 'next/link';
import { listPaidBookings, getPaidBookingStats } from '@/features/booking/booking.repository';
import { formatAmount } from '@/features/payments/format-amount';

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

/**
 * Paid bookings KPIs + table, shared by the consultant dashboard and the admin Bookings page.
 * Server component — the page around it is responsible for the auth check.
 *
 * @param {{ basePath: string, page: number }} props - basePath: URL of the hosting page (pagination links)
 */
export default async function PaidBookingsPanel({ basePath, page }) {
  const currentPage = Math.max(Number(page) || 1, 1);
  const dashboardHref = (targetPage = 1) => (targetPage > 1 ? `${basePath}?page=${targetPage}` : basePath);

  const [{ bookings, totalCount }, stats] = await Promise.all([
    listPaidBookings({ page: currentPage, pageSize: PAGE_SIZE }),
    getPaidBookingStats(),
  ]);

  const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1);

  return (
    <>
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
            <span className="card-label">Paid This Month</span>
            <span className="card-pill-tag">Month</span>
          </div>
          <div className="card-val">{stats.paidThisMonthCount}</div>
          <div className="card-subtext">Since the 1st</div>
        </div>
      </div>

      {/* Paid Bookings Table */}
      <div className="admin-table-card">
        <div className="admin-table-head">
          <h2 className="admin-table-title">Paid Consultation Bookings</h2>
          <span className="card-pill-tag">{totalCount} paid</span>
        </div>

        {bookings.length === 0 ? (
          <div className="admin-table-empty">
            No paid bookings yet.
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
              <Link href={dashboardHref(currentPage - 1)}>← Previous</Link>
            ) : (
              <span />
            )}
            <span>
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link href={dashboardHref(currentPage + 1)}>Next →</Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </>
  );
}
