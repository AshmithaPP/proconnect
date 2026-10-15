import React from 'react';
import Link from 'next/link';
import { getConsultantAnalytics, ANALYTICS_RANGES } from '@/features/analytics/analytics.repository';
import { formatAmount } from '@/features/payments/format-amount';
import { ColumnChart, BarList, Heatmap, Funnel } from '@/features/analytics/components/charts';
import { retryPendingReschedules } from '@/features/reschedule/reschedule.service';

/** Signed change vs last month with a direction icon (never colour alone) */
function Delta({ percent }) {
  if (percent === null || percent === undefined) return <span className="kpi-delta neutral">No data last month</span>;
  const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
  const icon = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '■';
  return (
    <span className={`kpi-delta ${direction}`}>
      <span aria-hidden="true">{icon}</span> {percent > 0 ? '+' : ''}
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
 * Consultant dashboard: KPIs, revenue, funnel, upcoming week, consultation-time heatmap and
 * client breakdowns. Shared by /consultant/dashboard and /admin/dashboard.
 * Server component — the page around it does the auth check.
 *
 * @param {{ basePath: string, range?: string, bookingsPath: string }} props
 */
export default async function AnalyticsDashboard({ basePath, range, bookingsPath }) {
  const rangeDays = ANALYTICS_RANGES.includes(Number(range)) ? Number(range) : 30;
  await retryPendingReschedules();
  const data = await getConsultantAnalytics({ rangeDays });
  const { kpis } = data;
  const inr = (paise) => formatAmount(paise);

  return (
    <>
      {/* One filter row above everything it scopes */}
      <div className="viz-filter-row">
        <span className="viz-filter-label">Period</span>
        <nav className="viz-segmented" aria-label="Analytics period">
          {ANALYTICS_RANGES.map((days) => (
            <Link
              key={days}
              href={`${basePath}?range=${days}`}
              className={`viz-segment${days === rangeDays ? ' active' : ''}`}
              aria-current={days === rangeDays ? 'true' : undefined}
              scroll={false}
            >
              Last {days} days
            </Link>
          ))}
        </nav>
        <span className="viz-muted viz-filter-note">Times in {data.timezone}</span>
      </div>

      <div className="admin-kpi-grid">
        <KpiTile label="Revenue this month" value={inr(kpis.revenueThisMonthPaise)} tag="INR">
          <Delta percent={kpis.revenueChangePercent} />
        </KpiTile>
        <KpiTile label="Paid bookings this month" value={kpis.bookingsThisMonth} tag="Month">
          <Delta percent={kpis.bookingsChangePercent} />
        </KpiTile>
        <KpiTile label="Consultations today" value={kpis.todayCount} tag="Today">
          {kpis.nextConsultation
            ? `Next: ${kpis.nextConsultation.dateLabel}, ${kpis.nextConsultation.slotLabel.split(' – ')[0]} — ${kpis.nextConsultation.fullName}`
            : 'Nothing else scheduled this week'}
        </KpiTile>
        <KpiTile label="Booked next 7 days" value={kpis.upcomingWeekCount} tag="Week">
          <Link href={`${bookingsPath}?view=upcoming`}>View upcoming →</Link>
        </KpiTile>
        <KpiTile label="Slot utilisation" value={kpis.utilisationPercent === null ? '—' : `${kpis.utilisationPercent}%`} tag="Booking window">
          <span className="kpi-meter" aria-hidden="true">
            <span style={{ width: `${kpis.utilisationPercent || 0}%` }} />
          </span>
          {kpis.bookedSlots} booked · {kpis.openSlots} still open
        </KpiTile>
        <KpiTile label="Checkout conversion" value={kpis.conversionPercent === null ? '—' : `${kpis.conversionPercent}%`} tag={`${rangeDays}d`}>
          Forms submitted that ended in a payment
        </KpiTile>
        <KpiTile label={`Revenue, last ${rangeDays} days`} value={inr(kpis.revenueInRangePaise)} tag={`${rangeDays}d`}>
          {kpis.bookingsInRange} bookings · avg {inr(kpis.averageBookingValuePaise)}
        </KpiTile>
        <KpiTile label="Automatic moves" value={kpis.autoMovesInRange} tag={`${rangeDays}d`}>
          {kpis.slotTakenMoves} slot taken · {kpis.unavailableMoves} you unavailable · {kpis.clientChangesInRange} changed by clients
          {kpis.rescheduleCount > 0 && (
            <>
              {' · '}
              <Link href={`${bookingsPath}?view=reschedule`}>{kpis.rescheduleCount} waiting for a free slot →</Link>
            </>
          )}
        </KpiTile>
      </div>

      <section className="settings-card viz-card">
        <h2 className="settings-card-title">Revenue per day</h2>
        <p className="settings-card-subtitle">
          Paid bookings by payment date, last {rangeDays} days · {inr(kpis.revenueInRangePaise)} in total · all time {inr(kpis.allTimeRevenuePaise)} from {kpis.allTimeBookings} payments
        </p>
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
              All {data.upcoming.length} upcoming →
            </Link>
          )}
        </section>
      </div>

      <section className="settings-card viz-card">
        <h2 className="settings-card-title">When clients book</h2>
        <p className="settings-card-subtitle">Consultation times of bookings paid in the last {rangeDays} days — darker means more bookings</p>
        <Heatmap heatmap={data.heatmap} caption={`Bookings by weekday and hour, last ${rangeDays} days`} />
      </section>

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
  );
}
