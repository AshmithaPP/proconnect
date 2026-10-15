import React from 'react';
import Link from 'next/link';
import { listBookingsForView, getBookingViewCounts, BOOKING_VIEW_KEYS } from '@/features/booking/booking.repository';
import { getBusinessTimezone } from '@/features/schedule/schedule.repository';
import { getZonedNow, formatDateLabel } from '@/features/schedule/slot-engine';
import { formatAmount } from '@/features/payments/format-amount';

const PAGE_SIZE = 20;

const VIEWS = {
  upcoming: { label: 'Upcoming', empty: 'No upcoming consultations.' },
  today: { label: 'Today', empty: 'No consultations today.' },
  past: { label: 'Past', empty: 'No past consultations yet.' },
  reschedule: { label: 'Needs reschedule', empty: 'No paid booking is waiting for a new time.' },
};

function formatDateTime(value, timezone) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone });
}

function withOther(value, otherValue) {
  return value === 'Other' && otherValue ? `Other (${otherValue})` : value || '—';
}

/**
 * Paid bookings by consultation date, shared by the consultant and admin Bookings pages.
 * Server component — the page around it does the auth check. State lives in the URL
 * (?view=&q=&page=) so tabs, search and pagination work without client JavaScript.
 *
 * @param {{ basePath: string, view?: string, page?: string, q?: string }} props
 */
export default async function BookingsManager({ basePath, view: requestedView, page, q }) {
  const view = BOOKING_VIEW_KEYS.includes(requestedView) ? requestedView : 'upcoming';
  const search = typeof q === 'string' ? q.trim().slice(0, 100) : '';
  const currentPage = Math.max(Number(page) || 1, 1);
  const timezone = await getBusinessTimezone();
  const today = getZonedNow(timezone).date;

  const [{ bookings, totalCount }, counts] = await Promise.all([
    listBookingsForView({ view, today, page: currentPage, pageSize: PAGE_SIZE, search }),
    getBookingViewCounts(today),
  ]);
  const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1);

  const href = (params) => {
    const query = new URLSearchParams();
    const next = { view, q: search, ...params };
    if (next.view && next.view !== 'upcoming') query.set('view', next.view);
    if (next.q) query.set('q', next.q);
    if (next.page && next.page > 1) query.set('page', String(next.page));
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="admin-table-card">
      <div className="bookings-toolbar">
        <nav className="portal-tabs bookings-tabs" aria-label="Booking views">
          {BOOKING_VIEW_KEYS.map((key) => (
            <Link key={key} href={href({ view: key, page: 1 })} className={`portal-tab${key === view ? ' active' : ''}`}>
              {VIEWS[key].label}
              <span className={`tab-count${key === 'reschedule' && counts[key] ? ' alert' : ''}`}>{counts[key]}</span>
            </Link>
          ))}
        </nav>
        <form className="bookings-search" action={basePath} method="get" role="search">
          {view !== 'upcoming' && <input type="hidden" name="view" value={view} />}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search name, company, email, phone"
            className="form-control-pro no-icon"
            aria-label="Search bookings"
          />
          <button type="submit" className="btn-pro btn-dark btn-sm">
            Search
          </button>
        </form>
      </div>

      {bookings.length === 0 ? (
        <div className="admin-table-empty">{search ? `No bookings match “${search}”.` : VIEWS[view].empty}</div>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Consultation</th>
                <th>Client</th>
                <th>Company</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Team Size</th>
                <th>Sales Challenge</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Ref</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.bookingId}>
                  <td className="cell-nowrap">
                    <span className={`cell-primary${booking.consultationDate === today ? ' is-today' : ''}`}>
                      {booking.consultationDate === today ? 'Today' : formatDateLabel(booking.consultationDate)}
                    </span>
                    <span className="cell-secondary">{booking.preferredTimeSlot}</span>
                    {booking.status === 'reschedule_required' && <span className="status-chip warn">Needs new time</span>}
                  </td>
                  <td>
                    <div className="cell-primary">{booking.fullName}</div>
                    <a className="cell-secondary" href={`mailto:${booking.workEmail}`}>
                      {booking.workEmail}
                    </a>
                  </td>
                  <td>{booking.companyName}</td>
                  <td className="cell-nowrap">
                    <a href={`tel:${booking.phoneNumber.replace(/[^+\d]/g, '')}`}>{booking.phoneNumber}</a>
                  </td>
                  <td>{withOther(booking.userRole, booking.userRoleOther)}</td>
                  <td className="cell-nowrap">{booking.salesTeamSize || '—'}</td>
                  <td>{withOther(booking.salesChallenge, booking.salesChallengeOther)}</td>
                  <td className="cell-nowrap">
                    {booking.payment ? formatAmount(booking.payment.amountPaise, booking.payment.currencyCode) : '—'}
                  </td>
                  <td className="cell-nowrap">{formatDateTime(booking.payment?.paidAt, timezone)}</td>
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
          {currentPage > 1 ? <Link href={href({ page: currentPage - 1 })}>← Previous</Link> : <span />}
          <span>
            Page {currentPage} of {totalPages} · {totalCount} bookings
          </span>
          {currentPage < totalPages ? <Link href={href({ page: currentPage + 1 })}>Next →</Link> : <span />}
        </div>
      )}
    </div>
  );
}
