'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiArrowRight,
  FiRefreshCw,
  FiAlertCircle,
} from 'react-icons/fi';
import { ANALYTICS_RANGES } from '@/features/analytics/analytics.definitions';
import { formatAmount } from '@/features/payments/format-amount';
import { ColumnChart, BarList, Heatmap, Funnel } from '@/features/analytics/components/charts';

/** Signed change vs last month with a direction icon (never colour alone) */
function Delta({ percent }) {
  if (percent === null || percent === undefined) {
    return <span className="kpi-delta neutral">No data last month</span>;
  }
  const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
  return (
    <span className={`kpi-delta ${direction}`}>
      <span aria-hidden="true" className="kpi-delta-icon">
        {direction === 'up' ? <FiTrendingUp /> : direction === 'down' ? <FiTrendingDown /> : <FiMinus />}
      </span>{' '}
      {percent > 0 ? '+' : ''}
      {percent}% vs same point last month
    </span>
  );
}

function KpiTile({ label, value, children, tag }) {
  return (
    <div className="admin-info-card kpi-tile">
      <div className="card-top-row">
        <span className="card-label">{label}</span>
        {tag && <span className="card-pill-tag">{tag}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="card-subtext">{children}</div>
    </div>
  );
}

/**
 * Modern, client-side Analytics Dashboard.
 * Fetches all analytics data dynamically from the backend API (/api/admin/analytics or /api/consultant/analytics).
 * Inspectable in browser DevTools Network (Fetch/XHR) tab.
 *
 * @param {{ basePath: string, range?: string, bookingsPath: string }} props
 */
export default function AnalyticsDashboard({ basePath, range, bookingsPath }) {
  const initialDays = ANALYTICS_RANGES.includes(Number(range)) ? Number(range) : 30;
  const [rangeDays, setRangeDays] = useState(initialDays);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAnalytics = useCallback(async (days) => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = basePath?.startsWith('/superadmin')
        ? '/api/superadmin/analytics'
        : basePath?.startsWith('/admin')
        ? '/api/admin/analytics'
        : '/api/consultant/analytics';

      const res = await fetch(`${endpoint}?range=${days}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch analytics (HTTP ${res.status})`);
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('[Analytics API] Error:', err);
      setError(err.message || 'Could not load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    loadAnalytics(rangeDays);
  }, [loadAnalytics, rangeDays]);

  const handlePeriodChange = (days) => {
    setRangeDays(days);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('range', String(days));
      window.history.replaceState({}, '', url.toString());
    }
  };

  const inr = (paise) => formatAmount(paise);

  return (
    <>
      {/* 1. Filter Row */}
      <div className="viz-filter-row">
        <span className="viz-filter-label">Period</span>
        <div className="viz-segmented" role="tablist" aria-label="Analytics period">
          {ANALYTICS_RANGES.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => handlePeriodChange(days)}
              className={`viz-segment${days === rangeDays ? ' active' : ''}`}
              aria-selected={days === rangeDays}
              role="tab"
              disabled={isLoading && days === rangeDays}
            >
              Last {days} days
            </button>
          ))}
        </div>

        {data?.timezone && (
          <span className="viz-muted viz-filter-note">
            Times in {data.timezone}
            {isLoading && <span style={{ marginLeft: '8px', opacity: 0.7 }}>· Updating…</span>}
          </span>
        )}
      </div>

      {/* 2. Loading State */}
      {isLoading && !data && (
        <div className="settings-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <FiRefreshCw className="icon-spin" style={{ fontSize: '1.4rem', marginBottom: '8px', display: 'inline-block' }} />
          <div>Loading analytics…</div>
        </div>
      )}

      {/* 3. Error State */}
      {error && !data && (
        <div className="form-alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
          <span>
            <FiAlertCircle className="icon-inline" style={{ marginRight: '6px' }} />
            {error}
          </span>
          <button
            type="button"
            onClick={() => loadAnalytics(rangeDays)}
            className="btn-pro btn-sm btn-light"
          >
            <FiRefreshCw className="icon-inline" /> Retry
          </button>
        </div>
      )}

      {/* 4. Analytics Data Sections */}
      {data && (
        <>
          {/* KPI Grid */}
          <div className="admin-kpi-grid">
            <KpiTile label="Revenue this month" value={inr(data.kpis.revenueThisMonthPaise)} tag="INR">
              <Delta percent={data.kpis.revenueChangePercent} />
            </KpiTile>

            <KpiTile label="Paid bookings this month" value={data.kpis.bookingsThisMonth} tag="Month">
              <Delta percent={data.kpis.bookingsChangePercent} />
            </KpiTile>

            <KpiTile label="Consultations today" value={data.kpis.todayCount} tag="Today">
              {data.kpis.nextConsultation
                ? `Next: ${data.kpis.nextConsultation.dateLabel}, ${data.kpis.nextConsultation.slotLabel.split(' – ')[0]} — ${data.kpis.nextConsultation.fullName}`
                : 'Nothing else scheduled this week'}
            </KpiTile>

            <KpiTile label="Booked next 7 days" value={data.kpis.upcomingWeekCount} tag="Week">
              <Link href={`${bookingsPath}?view=upcoming`}>
                View upcoming <FiArrowRight className="icon-inline" />
              </Link>
            </KpiTile>

            <KpiTile label="Slot utilisation" value={data.kpis.utilisationPercent === null ? '—' : `${data.kpis.utilisationPercent}%`} tag="Booking window">
              <span className="kpi-meter" aria-hidden="true">
                <span style={{ width: `${data.kpis.utilisationPercent || 0}%` }} />
              </span>
              {data.kpis.bookedSlots} booked · {data.kpis.openSlots} still open
            </KpiTile>

            <KpiTile label="Checkout conversion" value={data.kpis.conversionPercent === null ? '—' : `${data.kpis.conversionPercent}%`} tag={`${rangeDays}d`}>
              Forms submitted that ended in a payment
            </KpiTile>

            <KpiTile label={`Revenue, last ${rangeDays} days`} value={inr(data.kpis.revenueInRangePaise)} tag={`${rangeDays}d`}>
              {data.kpis.bookingsInRange} bookings · avg {inr(data.kpis.averageBookingValuePaise)}
            </KpiTile>

            <KpiTile label="Automatic moves" value={data.kpis.autoMovesInRange} tag={`${rangeDays}d`}>
              {data.kpis.slotTakenMoves} slot taken · {data.kpis.unavailableMoves} you unavailable · {data.kpis.clientChangesInRange} changed by clients
              {data.kpis.rescheduleCount > 0 && (
                <>
                  {' · '}
                  <Link href={`${bookingsPath}?view=reschedule`}>
                    {data.kpis.rescheduleCount} waiting for a free slot <FiArrowRight className="icon-inline" />
                  </Link>
                </>
              )}
            </KpiTile>
          </div>

          {/* Revenue Per Day Chart Card */}
          <section className="settings-card viz-card">
            <div className="viz-card-header">
              <div>
                <h2 className="settings-card-title">Revenue per day</h2>
                <p className="settings-card-subtitle mb-0">
                  Paid bookings by payment date · Last {rangeDays} days
                </p>
              </div>
              <div className="viz-card-stat-pill">
                <span className="viz-stat-pill-label">Period Total:</span>
                <span className="viz-stat-pill-value">{inr(data.kpis.revenueInRangePaise)}</span>
                <span className="viz-stat-pill-divider">·</span>
                <span className="viz-stat-pill-sub">All time {inr(data.kpis.allTimeRevenuePaise)} ({data.kpis.allTimeBookings} paid)</span>
              </div>
            </div>
            <ColumnChart
              caption={`Revenue per day, last ${rangeDays} days`}
              valueHeading="Revenue"
              tickFormat="inr-paise"
              data={data.dailyRevenue.map((d) => ({
                key: d.date,
                label: d.label,
                value: d.revenuePaise,
                valueLabel: inr(d.revenuePaise),
                detail: d.bookings ? `${d.bookings} booking${d.bookings === 1 ? '' : 's'}` : undefined,
              }))}
            />
          </section>

          {/* Booking Funnel & Upcoming Week */}
          <div className="viz-two-col">
            <section className="settings-card viz-card">
              <h2 className="settings-card-title">Booking funnel</h2>
              <p className="settings-card-subtitle">Booking forms submitted in the last {rangeDays} days and how far they got</p>
              <Funnel stages={data.funnel} caption={`Booking funnel, last ${rangeDays} days`} />
            </section>

            <section className="settings-card viz-card">
              <h2 className="settings-card-title">Upcoming week</h2>
              <p className="settings-card-subtitle">Paid consultations in the next 7 days</p>
              {data.upcoming.length === 0 ? (
                <p className="viz-empty">No consultations booked for the next 7 days.</p>
              ) : (
                <ul className="upcoming-list">
                  {data.upcoming.slice(0, 8).map((item) => (
                    <li key={item.bookingId} className={`upcoming-item${item.isToday ? ' is-today' : ''}`}>
                      <span className="upcoming-when">
                        <strong>{item.dateLabel}</strong>
                        <span>{item.slotLabel}</span>
                      </span>
                      <span className="upcoming-who">
                        <strong>{item.fullName}</strong>
                        <span>{item.companyName}</span>
                      </span>
                      <a className="upcoming-phone" href={`tel:${item.phoneNumber.replace(/[^+\d]/g, '')}`}>
                        {item.phoneNumber}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {data.upcoming.length > 8 && (
                <Link href={`${bookingsPath}?view=upcoming`} className="viz-more-link">
                  All {data.upcoming.length} upcoming <FiArrowRight className="icon-inline" />
                </Link>
              )}
            </section>
          </div>

          {/* When Clients Book (Heatmap) */}
          <section className="settings-card viz-card">
            <h2 className="settings-card-title">When clients book</h2>
            <p className="settings-card-subtitle">Consultation times of bookings paid in the last {rangeDays} days — darker means more bookings</p>
            <Heatmap heatmap={data.heatmap} caption={`Bookings by weekday and hour, last ${rangeDays} days`} />
          </section>

          {/* Client Breakdowns */}
          <div className="viz-three-col">
            <section className="settings-card viz-card">
              <h2 className="settings-card-title">Sales challenge</h2>
              <p className="settings-card-subtitle">What paying clients want help with</p>
              <BarList items={data.breakdowns.salesChallenge} caption="Bookings by sales challenge" />
            </section>
            <section className="settings-card viz-card">
              <h2 className="settings-card-title">Client role</h2>
              <p className="settings-card-subtitle">Who books</p>
              <BarList items={data.breakdowns.userRole} caption="Bookings by client role" />
            </section>
            <section className="settings-card viz-card">
              <h2 className="settings-card-title">Sales team size</h2>
              <p className="settings-card-subtitle">Size of the client&apos;s team</p>
              <BarList items={data.breakdowns.teamSize} caption="Bookings by sales team size" />
            </section>
          </div>
        </>
      )}
    </>
  );
}
