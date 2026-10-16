'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiVideo, FiRefreshCw, FiAlertCircle, FiSearch, FiX } from 'react-icons/fi';
import { formatDateLabel, formatSlotLabel } from '@/features/schedule/slot-engine';
import { formatAmount } from '@/features/payments/format-amount';

const PAGE_SIZE = 20;

const BOOKING_VIEW_KEYS = ['upcoming', 'today', 'past', 'reschedule'];

const VIEWS = {
  upcoming: { label: 'Upcoming', empty: 'No upcoming consultations.' },
  today: { label: 'Today', empty: 'No consultations today.' },
  past: { label: 'Past', empty: 'No past consultations yet.' },
  reschedule: {
    label: 'Needs reschedule',
    empty:
      'Nothing waiting — every paid booking has a time. (Bookings are moved automatically; this list only shows the rare case where no slot is free in the next 30 days.)',
  },
};

const MOVE_LABELS = {
  slot_taken: 'Auto-moved · slot was taken',
  consultant_unavailable: 'Auto-moved · you were unavailable',
  customer_request: 'Changed by the client',
};

function formatDateTime(value, timezone) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || 'Asia/Kolkata',
    });
  } catch {
    return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }
}

function withOther(value, otherValue) {
  return value === 'Other' && otherValue ? `Other (${otherValue})` : value || '—';
}

/**
 * Dynamic, client-side Bookings Manager.
 * Fetches all bookings data dynamically from the backend API (/api/admin/bookings or /api/consultant/bookings).
 * Inspectable in the browser Network (Fetch/XHR) tab.
 *
 * @param {{ basePath: string, view?: string, page?: string|number, q?: string }} props
 */
export default function BookingsManager({ basePath, view: initialView, page: initialPage, q: initialQ }) {
  const safeInitialView = BOOKING_VIEW_KEYS.includes(initialView) ? initialView : 'upcoming';
  const safeInitialPage = Math.max(Number(initialPage) || 1, 1);
  const safeInitialQ = typeof initialQ === 'string' ? initialQ : '';

  const [view, setView] = useState(safeInitialView);
  const [page, setPage] = useState(safeInitialPage);
  const [search, setSearch] = useState(safeInitialQ);
  const [searchInput, setSearchInput] = useState(safeInitialQ);

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine API endpoint based on basePath
  const endpoint = basePath?.startsWith('/admin')
    ? '/api/admin/bookings'
    : basePath?.startsWith('/superadmin')
    ? '/api/admin/bookings'
    : '/api/consultant/bookings';

  const updateUrl = useCallback(
    (nextView, nextPage, nextSearch) => {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      if (nextView && nextView !== 'upcoming') {
        url.searchParams.set('view', nextView);
      } else {
        url.searchParams.delete('view');
      }

      if (nextSearch) {
        url.searchParams.set('q', nextSearch);
      } else {
        url.searchParams.delete('q');
      }

      if (nextPage && nextPage > 1) {
        url.searchParams.set('page', String(nextPage));
      } else {
        url.searchParams.delete('page');
      }

      window.history.replaceState({}, '', url.toString());
    },
    []
  );

  const fetchBookings = useCallback(
    async (targetView, targetPage, targetSearch) => {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          view: targetView,
          page: String(targetPage),
          pageSize: String(PAGE_SIZE),
        });
        if (targetSearch) {
          queryParams.set('q', targetSearch);
        }

        const res = await fetch(`${endpoint}?${queryParams.toString()}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP ${res.status}`);
        }

        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('[Bookings API] Error:', err);
        setError(err.message || 'Could not load bookings from server');
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint]
  );

  useEffect(() => {
    fetchBookings(view, page, search);
  }, [fetchBookings, view, page, search]);

  const handleViewChange = (newView) => {
    if (newView === view) return;
    setView(newView);
    setPage(1);
    updateUrl(newView, 1, search);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const cleanSearch = searchInput.trim().slice(0, 100);
    setSearch(cleanSearch);
    setPage(1);
    updateUrl(view, 1, cleanSearch);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
    updateUrl(view, 1, '');
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    updateUrl(view, newPage, search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleManualRefresh = () => {
    fetchBookings(view, page, search);
  };

  const bookings = data?.bookings || [];
  const counts = data?.counts || { upcoming: 0, today: 0, past: 0, reschedule: 0 };
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const moves = data?.moves || {};
  const today = data?.today || '';
  const timezone = data?.timezone || 'Asia/Kolkata';

  return (
    <div className="admin-table-card">
      {/* Toolbar: Views & Search */}
      <div className="bookings-toolbar">
        <nav className="portal-tabs bookings-tabs" aria-label="Booking views">
          {BOOKING_VIEW_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleViewChange(key)}
              className={`portal-tab${key === view ? ' active' : ''}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
            >
              {VIEWS[key].label}
              <span className={`tab-count${key === 'reschedule' && counts[key] ? ' alert' : ''}`}>
                {counts[key] ?? 0}
              </span>
            </button>
          ))}
        </nav>

        <form className="bookings-search" onSubmit={handleSearchSubmit} role="search">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, company, email, phone"
            className="form-control-pro no-icon"
            aria-label="Search bookings"
          />
          <button type="submit" className="btn-pro btn-dark btn-sm" disabled={isLoading}>
            <FiSearch style={{ marginRight: '4px' }} />
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="btn-pro btn-light btn-sm"
              title="Clear search filter"
            >
              <FiX /> Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="btn-pro btn-light btn-sm"
            title="Refresh bookings"
            style={{ padding: '6px 10px' }}
          >
            <FiRefreshCw className={isLoading ? 'icon-spin' : ''} />
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && !data && (
        <div
          className="form-alert"
          style={{
            margin: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            <FiAlertCircle className="icon-inline" style={{ marginRight: 6 }} />
            {error}
          </span>
          <button type="button" onClick={handleManualRefresh} className="btn-pro btn-sm btn-light">
            Retry
          </button>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && !data && (
        <div
          style={{
            padding: '50px 20px',
            textAlign: 'center',
            color: 'var(--color-text-muted, #64748b)',
          }}
        >
          <FiRefreshCw className="icon-spin" style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
          <div>Loading bookings…</div>
        </div>
      )}

      {/* Empty State */}
      {data && bookings.length === 0 && (
        <div className="admin-table-empty">
          {search ? `No bookings match “${search}”.` : VIEWS[view].empty}
        </div>
      )}

      {/* Data Table */}
      {data && bookings.length > 0 && (
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
              {bookings.map((booking) => {
                const move = moves[booking.bookingId];
                return (
                  <tr key={booking.bookingId}>
                    <td className="cell-nowrap">
                      <span className={`cell-primary${booking.consultationDate === today ? ' is-today' : ''}`}>
                        {booking.consultationDate === today ? 'Today' : formatDateLabel(booking.consultationDate)}
                      </span>
                      <span className="cell-secondary">{booking.preferredTimeSlot}</span>
                      {booking.googleMeetLink && (
                        <div style={{ marginTop: 4 }}>
                          <a
                            href={booking.googleMeetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="status-chip ok"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                            title="Open Google Meet video call"
                          >
                            <FiVideo size={12} /> Meet
                          </a>
                        </div>
                      )}
                      {booking.status === 'reschedule_required' && (
                        <span
                          className="status-chip warn"
                          title="No free slot in the next 30 days yet — it is booked automatically as soon as one opens"
                        >
                          Waiting for a free slot
                        </span>
                      )}
                      {move && (
                        <span
                          className={`status-chip ${move.reason === 'customer_request' ? 'muted' : 'ok'}`}
                          title={`Originally ${formatDateLabel(move.firstPrevious.date)}, ${formatSlotLabel(
                            move.firstPrevious.startTime,
                            move.firstPrevious.endTime
                          )} · moved ${move.moveCount}×`}
                        >
                          {MOVE_LABELS[move.reason]}
                        </span>
                      )}
                      {move && (
                        <span className="cell-secondary cell-strike">
                          was {formatDateLabel(move.previous.date, { withYear: false })},{' '}
                          {
                            formatSlotLabel(move.previous.startTime, move.previous.endTime).split(
                              ' – '
                            )[0]
                          }
                        </span>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="admin-table-pagination">
          {page > 1 ? (
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              className="btn-pro btn-light btn-sm"
              disabled={isLoading}
            >
              ← Previous
            </button>
          ) : (
            <span />
          )}
          <span>
            Page {page} of {totalPages} · {totalCount} bookings
          </span>
          {page < totalPages ? (
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              className="btn-pro btn-light btn-sm"
              disabled={isLoading}
            >
              Next →
            </button>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
