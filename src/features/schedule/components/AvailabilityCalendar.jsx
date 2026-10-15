'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { addDays, formatDateLabel, formatTimeLabel, timeToMinutes, BUSINESS_HOURS } from '@/features/schedule/slot-engine';

const WEEK_DAYS = 7;
const MAX_DAYS_AHEAD = 60;

/** The day's sections, taken from the business hours (Morning 10–1, Afternoon & evening 2–10) */
const SECTIONS = BUSINESS_HOURS.map((range, index) => ({
  title: index === 0 ? 'Morning' : 'Afternoon & evening',
  hours: `${formatTimeLabel(timeToMinutes(range.startTime))} – ${formatTimeLabel(timeToMinutes(range.endTime))}`,
  start: range.startTime,
  end: range.endTime,
}));

const startOnly = (slot) => formatTimeLabel(timeToMinutes(slot.startTime));

const SLOT_STATE = {
  available: 'Free',
  blocked: 'Off',
  past: 'Done',
};

/**
 * Availability: pick a day, tap a time to switch it off or on, or take the whole day off.
 * A booked time can also be switched off — its booking then moves automatically to the next
 * free time and the client is emailed.
 */
export default function AvailabilityCalendar() {
  const [data, setData] = useState(null);
  const [fromDate, setFromDate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async (from) => {
    const query = new URLSearchParams({ days: String(WEEK_DAYS) });
    if (from) query.set('from', from);
    const res = await fetch(`/api/consultant/availability?${query}`, { cache: 'no-store' });
    if (!res.ok) {
      setMessage({ type: 'error', text: res.status === 401 ? 'Your session has expired. Please sign in again.' : 'Could not load your availability.' });
      return;
    }
    const json = await res.json();
    setData(json);
    setFromDate(json.days[0]?.date || from);
    setSelectedDate((current) => (current && json.days.some((d) => d.date === current) ? current : json.days[0]?.date));
  }, []);

  useEffect(() => {
    load(null);
  }, [load]);

  useEffect(() => {
    if (!message || message.type === 'error') return undefined;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  const send = async (key, url, method, body, successText) => {
    setBusyKey(key);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: json.error || 'Could not save. Please try again.' });
        return;
      }
      const moved = (json.movedBookings || []).map((b) =>
        b.outcome === 'moved' ? `${b.fullName} moved to ${b.newTime}` : `${b.fullName} will be moved as soon as a time is free`
      );
      setMessage({ type: 'success', text: [successText, ...moved].join(' · ') });
      await load(fromDate);
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setBusyKey(null);
    }
  };

  const toggleSlot = (day, slot) => {
    const when = `${formatDateLabel(day.date, { withYear: false })}, ${startOnly(slot)}`;
    if (slot.status === 'available') {
      send(slot.slotKey, '/api/consultant/time-off', 'POST', { offDate: day.date, startTime: slot.startTime, endTime: slot.endTime }, `${when} is now off`);
    } else if (slot.status === 'blocked' && slot.timeOffId && !day.isDayOff) {
      send(slot.slotKey, `/api/consultant/time-off/${slot.timeOffId}`, 'DELETE', null, `${when} is free again`);
    } else if (slot.status === 'booked' && slot.booking) {
      if (!window.confirm(`${slot.booking.fullName} is booked at ${when}.\n\nSwitch this time off? Their booking will move to the next free time and they will be emailed.`)) return;
      send(slot.slotKey, '/api/consultant/time-off', 'POST', { offDate: day.date, startTime: slot.startTime, endTime: slot.endTime, confirmMove: true }, `${when} is now off`);
    }
  };

  const toggleDay = (day) => {
    const label = formatDateLabel(day.date, { withYear: false });
    if (day.isDayOff) {
      send(day.date, `/api/consultant/time-off/${day.dayOffId}`, 'DELETE', null, `${label} is open again`);
      return;
    }
    const booked = day.slots.filter((s) => s.status === 'booked').length;
    if (booked && !window.confirm(`${label} has ${booked} booking${booked === 1 ? '' : 's'}.\n\nTake the day off? They will move to the next free times and be emailed.`)) return;
    send(day.date, '/api/consultant/time-off', 'POST', { offDate: day.date, confirmMove: booked > 0 }, `${label} is now a day off`);
  };

  if (!data) {
    return <div className="settings-card av-loading">{message ? message.text : 'Loading…'}</div>;
  }

  const day = data.days.find((d) => d.date === selectedDate) || data.days[0];
  const canGoBack = fromDate > data.today;
  const canGoForward = addDays(fromDate, WEEK_DAYS) <= addDays(data.today, MAX_DAYS_AHEAD - WEEK_DAYS);
  const lastDate = data.days[data.days.length - 1]?.date;
  const dayIsPast = day.slots.length > 0 && day.slots.every((s) => s.status === 'past');

  return (
    <div className="av">
      {/* Week */}
      <div className="av-week-head">
        <button type="button" className="av-arrow" onClick={() => load(addDays(fromDate, -WEEK_DAYS) < data.today ? data.today : addDays(fromDate, -WEEK_DAYS))} disabled={!canGoBack || Boolean(busyKey)} aria-label="Previous week">
          <FiChevronLeft />
        </button>
        <span className="av-week-label">
          {formatDateLabel(fromDate, { withYear: false })} – {formatDateLabel(lastDate, { withYear: false })}
        </span>
        <button type="button" className="av-arrow" onClick={() => load(addDays(fromDate, WEEK_DAYS))} disabled={!canGoForward || Boolean(busyKey)} aria-label="Next week">
          <FiChevronRight />
        </button>
      </div>

      <div className="av-days" role="tablist" aria-label="Days">
        {data.days.map((d) => {
          const [weekday, dateNumber] = formatDateLabel(d.date, { withYear: false }).replace(',', '').split(' ');
          const summary = d.isDayOff ? 'Day off' : d.availableCount === 0 ? 'Full' : `${d.availableCount} free`;
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={d.date === day.date}
              className={`av-day${d.date === day.date ? ' is-selected' : ''}${d.isDayOff ? ' is-off' : ''}`}
              onClick={() => setSelectedDate(d.date)}
            >
              <span className="av-day-name">{d.isToday ? 'Today' : weekday}</span>
              <span className="av-day-number">{dateNumber}</span>
              <span className="av-day-summary">{summary}</span>
            </button>
          );
        })}
      </div>

      {message && (
        <div className={`av-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
          {message.text}
        </div>
      )}

      {/* Selected day */}
      <section className="settings-card av-panel">
        <div className="av-panel-head">
          <div>
            <h2 className="av-panel-title">{formatDateLabel(day.date).replace(/ \d{4}$/, '')}</h2>
            <p className="av-panel-hint">
              {day.isDayOff ? 'You are off this day. Customers cannot book it.' : 'Tap a time to switch it off or on.'}
            </p>
          </div>
          {!dayIsPast && (
            <button type="button" className={`btn-pro btn-sm ${day.isDayOff ? 'btn-orange' : 'btn-light'}`} onClick={() => toggleDay(day)} disabled={Boolean(busyKey)}>
              {busyKey === day.date ? 'Saving…' : day.isDayOff ? 'Open this day' : 'Take the day off'}
            </button>
          )}
        </div>

        {!day.isDayOff &&
          SECTIONS.map((section) => {
            const slots = day.slots.filter((s) => s.startTime >= section.start && s.startTime < section.end);
            if (!slots.length) return null;
            return (
              <div key={section.title} className="av-section">
                <div className="av-section-head">
                  <span>{section.title}</span>
                  <span className="av-section-hours">{section.hours}</span>
                </div>
                <div className="av-slots">
                  {slots.map((slot) => {
                    const clickable = !busyKey && (slot.status === 'available' || slot.status === 'blocked' || (slot.status === 'booked' && slot.booking && !slot.outsideHours));
                    return (
                      <button
                        key={slot.slotKey}
                        type="button"
                        className={`av-slot ${slot.status}`}
                        disabled={!clickable}
                        onClick={() => toggleSlot(day, slot)}
                        title={slot.label}
                      >
                        <span className="av-slot-time">{startOnly(slot)}</span>
                        <span className="av-slot-state">
                          {busyKey === slot.slotKey ? 'Saving…' : slot.booking ? slot.booking.fullName : SLOT_STATE[slot.status]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

        {/* Bookings outside business hours (e.g. after a length change) stay visible */}
        {day.slots.some((s) => s.outsideHours) && (
          <div className="av-section">
            <div className="av-section-head">
              <span>Outside your hours</span>
            </div>
            <div className="av-slots">
              {day.slots
                .filter((s) => s.outsideHours)
                .map((slot) => (
                  <span key={slot.slotKey} className="av-slot booked" title={slot.label}>
                    <span className="av-slot-time">{startOnly(slot)}</span>
                    <span className="av-slot-state">{slot.booking?.fullName}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
