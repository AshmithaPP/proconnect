'use client';

import React from 'react';
import { ClockIcon, CalendarIcon } from '@/components/ui/Icons';

/**
 * Date strip (booking window) + slot grid for the chosen day.
 * Data comes from GET /api/bookings/availability (slot engine). Only "available" slots can
 * be picked; booked / unavailable ones are shown greyed so customers see the day's shape.
 *
 * @param {{
 *   days: Array<{ date: string, dateLabel: string, isToday: boolean, isClosed: boolean, availableCount: number,
 *     slots: Array<{ slotKey: string, label: string, status: 'available'|'booked'|'unavailable' }> }>,
 *   selectedDate: string, onSelectDate: (date: string) => void,
 *   value: string, onChange: (slotKey: string) => void,
 *   isLoading: boolean, slotDurationMinutes: number
 * }} props
 */
export default function SlotCalendarPicker({ days, selectedDate, onSelectDate, value, onChange, isLoading, slotDurationMinutes }) {
  const day = days.find((d) => d.date === selectedDate);

  if (isLoading && days.length === 0) {
    return <div className="slot-calendar-empty">Loading available times…</div>;
  }
  if (days.length === 0) {
    return <div className="slot-calendar-empty">No booking dates are open right now. Please check back soon.</div>;
  }

  return (
    <div className="slot-calendar">
      <div className="date-chip-row" role="radiogroup" aria-label="Consultation date">
        {days.map((d) => {
          const [weekday, dayOfMonth, month] = d.dateLabel.replace(',', '').split(' ');
          const unavailable = d.isClosed || d.availableCount === 0;
          return (
            <button
              type="button"
              key={d.date}
              role="radio"
              aria-checked={d.date === selectedDate}
              className={`date-chip${d.date === selectedDate ? ' active' : ''}${unavailable ? ' is-full' : ''}`}
              onClick={() => onSelectDate(d.date)}
            >
              <span className="date-chip-weekday">{d.isToday ? 'Today' : weekday}</span>
              <span className="date-chip-day">{dayOfMonth}</span>
              <span className="date-chip-month">{month}</span>
              <span className="date-chip-meta">
                {d.isClosed ? 'Closed' : d.availableCount === 0 ? 'Full' : `${d.availableCount} left`}
              </span>
            </button>
          );
        })}
      </div>

      {day && (
        <div className="slot-day-panel">
          <div className="slot-day-head">
            <span className="slot-day-title">
              <CalendarIcon className="slot-day-icon" /> {day.dateLabel}
            </span>
            <span className="slot-menu-head-badge">{slotDurationMinutes} mins · 1-on-1</span>
          </div>

          {day.isClosed ? (
            <div className="slot-calendar-empty">The consultant is not available on this day. Please pick another date.</div>
          ) : day.slots.length === 0 ? (
            <div className="slot-calendar-empty">No slots on this day.</div>
          ) : (
            <div className="slot-chip-grid" role="radiogroup" aria-label={`Time slots on ${day.dateLabel}`}>
              {day.slots.map((slot) => {
                const isAvailable = slot.status === 'available';
                const isSelected = value === slot.slotKey;
                return (
                  <button
                    type="button"
                    key={slot.slotKey}
                    role="radio"
                    aria-checked={isSelected}
                    disabled={!isAvailable}
                    className={`slot-chip${isSelected ? ' active' : ''}${!isAvailable ? ' slot-disabled' : ''}`}
                    onClick={() => isAvailable && onChange(slot.slotKey)}
                    title={isAvailable ? slot.label : slot.status === 'booked' ? 'Already booked' : 'Not available'}
                  >
                    <ClockIcon className="slot-chip-icon" />
                    <span className="slot-chip-time">{slot.label}</span>
                    {!isAvailable && <span className="slot-chip-tag">{slot.status === 'booked' ? 'Booked' : 'Unavailable'}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
