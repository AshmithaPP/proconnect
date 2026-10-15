'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import FormStatus from '@/components/portal/form/FormStatus';
import { addDays, formatDateLabel } from '@/features/schedule/slot-engine';

const MAX_DAYS_AHEAD = 60;

const STATUS_TEXT = {
  available: 'Open',
  blocked: 'Unavailable',
  booked: 'Booked',
  past: 'Past',
};

/**
 * Consultant availability: every day in view with its slots. Click an open slot to mark
 * yourself unavailable, click it again to reopen; or switch a whole day off. Paid bookings
 * can't be blocked (they must be rescheduled first). Customers see changes immediately.
 *
 * @param {{ schedulePath: string, initialWindowDays: number }} props
 */
export default function AvailabilityCalendar({ schedulePath, initialWindowDays }) {
  const pageDays = Math.min(Math.max(initialWindowDays, 7), 14);
  const [fromDate, setFromDate] = useState(null);
  const [data, setData] = useState(null);
  const [reason, setReason] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [status, setStatus] = useState(null);

  const load = useCallback(async (from) => {
    const query = new URLSearchParams({ days: String(pageDays) });
    if (from) query.set('from', from);
    const res = await fetch(`/api/consultant/availability?${query}`, { cache: 'no-store' });
    if (!res.ok) {
      setStatus({ type: 'error', message: res.status === 401 ? 'Your session has expired. Please sign in again.' : 'Could not load availability' });
      return;
    }
    const json = await res.json();
    setData(json);
    setFromDate(json.days[0]?.date || from);
  }, [pageDays]);

  useEffect(() => {
    load(null);
  }, [load]);

  const send = async (key, url, method, body, successMessage) => {
    setBusyKey(key);
    setStatus(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ type: 'error', message: json.error || 'Could not save' });
      } else {
        setStatus({ type: 'success', message: successMessage });
        await load(fromDate);
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setBusyKey(null);
    }
  };

  const toggleSlot = (day, slot) => {
    if (slot.status === 'available') {
      send(slot.slotKey, '/api/consultant/time-off', 'POST', { offDate: day.date, startTime: slot.startTime, endTime: slot.endTime, timeOffReason: reason }, `${formatDateLabel(day.date)} ${slot.label} marked unavailable`);
    } else if (slot.status === 'blocked' && slot.timeOffId && !day.isDayOff) {
      send(slot.slotKey, `/api/consultant/time-off/${slot.timeOffId}`, 'DELETE', null, `${formatDateLabel(day.date)} ${slot.label} is open again`);
    }
  };

  const toggleDay = (day) => {
    if (day.isDayOff) {
      send(day.date, `/api/consultant/time-off/${day.dayOffId}`, 'DELETE', null, `${formatDateLabel(day.date)} is open again`);
    } else {
      send(day.date, '/api/consultant/time-off', 'POST', { offDate: day.date, timeOffReason: reason }, `${formatDateLabel(day.date)} marked unavailable`);
    }
  };

  if (!data) {
    return status ? <FormStatus status={status} /> : <div className="settings-card">Loading availability…</div>;
  }

  const lastAllowed = addDays(data.today, MAX_DAYS_AHEAD - pageDays);
  const canGoBack = fromDate > data.today;
  const canGoForward = fromDate < lastAllowed;

  return (
    <div className="admin-dashboard-full" style={{ gap: 16 }}>
      <div className="settings-card availability-toolbar">
        <div className="availability-legend" aria-label="Legend">
          {['available', 'blocked', 'booked', 'past'].map((key) => (
            <span key={key} className="legend-item">
              <span className={`avail-swatch ${key}`} aria-hidden="true" /> {STATUS_TEXT[key]}
            </span>
          ))}
        </div>
        <div className="availability-controls">
          <input
            type="text"
            className="form-control-pro no-icon"
            placeholder="Reason for new blocks (optional, private)"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason for marking unavailable"
          />
          <div className="row-actions">
            <button type="button" className="btn-pro btn-light btn-sm" disabled={!canGoBack || busyKey} onClick={() => load(addDays(fromDate, -pageDays) < data.today ? data.today : addDays(fromDate, -pageDays))}>
              ← Earlier
            </button>
            <button type="button" className="btn-pro btn-light btn-sm" disabled={!canGoForward || busyKey} onClick={() => load(addDays(fromDate, pageDays))}>
              Later →
            </button>
          </div>
        </div>
        <p className="field-hint" style={{ margin: 0 }}>
          Customers can book {data.rules.bookingWindowDays} days ahead. Change hours, slot length or the window in{' '}
          <Link href={schedulePath}>Schedule &amp; Pricing</Link>.
        </p>
        <FormStatus status={status} />
      </div>

      {data.days.map((day) => {
        const insideWindow = day.date <= addDays(data.today, data.rules.bookingWindowDays - 1);
        const bookedCount = day.slots.filter((s) => s.status === 'booked').length;
        return (
          <section key={day.date} className={`settings-card availability-day${day.isDayOff ? ' is-off' : ''}`}>
            <div className="availability-day-head">
              <div>
                <h2 className="settings-card-title">
                  {day.isToday ? `Today · ${day.dateLabel}` : day.dateLabel}
                </h2>
                <p className="settings-card-subtitle" style={{ marginBottom: 0 }}>
                  {day.isClosed
                    ? 'Closed (no weekly hours on this day)'
                    : day.isDayOff
                      ? `You are unavailable all day${day.dayOffReason ? ` — ${day.dayOffReason}` : ''}`
                      : `${day.availableCount} open · ${bookedCount} booked`}
                  {!insideWindow && ' · not yet bookable by customers'}
                </p>
              </div>
              {!day.isClosed && (
                <button
                  type="button"
                  className={`btn-pro btn-sm ${day.isDayOff ? 'btn-orange' : 'btn-light'}`}
                  disabled={busyKey === day.date || (!day.isDayOff && bookedCount > 0)}
                  title={!day.isDayOff && bookedCount > 0 ? 'This day has paid bookings — reschedule them first' : undefined}
                  onClick={() => toggleDay(day)}
                >
                  {busyKey === day.date ? 'Saving…' : day.isDayOff ? 'Make day available' : 'Mark whole day unavailable'}
                </button>
              )}
            </div>

            {!day.isClosed && day.slots.length > 0 && (
              <div className="avail-slot-grid">
                {day.slots.map((slot) => {
                  const clickable = (slot.status === 'available' || (slot.status === 'blocked' && !day.isDayOff)) && !busyKey;
                  return (
                    <button
                      key={slot.slotKey}
                      type="button"
                      className={`avail-slot ${slot.status}`}
                      disabled={!clickable}
                      onClick={() => toggleSlot(day, slot)}
                      aria-label={`${slot.label}: ${STATUS_TEXT[slot.status]}${slot.booking ? ` — ${slot.booking.fullName}` : ''}${clickable ? (slot.status === 'available' ? '. Click to mark unavailable' : '. Click to reopen') : ''}`}
                    >
                      <span className="avail-slot-time">{slot.label}</span>
                      <span className="avail-slot-state">
                        {busyKey === slot.slotKey ? 'Saving…' : slot.booking ? `${slot.booking.fullName}` : STATUS_TEXT[slot.status]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
