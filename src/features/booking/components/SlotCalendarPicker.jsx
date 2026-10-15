'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ClockIcon, CalendarIcon, ChevronDownIcon } from '@/components/ui/Icons';

/**
 * Modern, clean, and compact Preferred Date & Time selector.
 * 1. Preferred Date: Clean dropdown with open dates.
 * 2. Preferred Time: Sleek custom dropdown displaying available slots for booking,
 *    and clearly showing booked/confirmed slots as cut off with strikethrough text
 *    and a red 'Booked' badge.
 *
 * @param {{
 *   days: Array<{ date: string, dateLabel: string, isToday: boolean, isClosed: boolean, availableCount: number,
 *     slots: Array<{ slotKey: string, label: string, status: 'available'|'booked'|'unavailable' }> }>,
 *   selectedDate: string, onSelectDate: (date: string) => void,
 *   value: string, onChange: (slotKey: string) => void,
 *   isLoading: boolean, slotDurationMinutes: number
 * }} props
 */
export default function SlotCalendarPicker({
  days = [],
  selectedDate,
  onSelectDate,
  value,
  onChange,
  isLoading,
  slotDurationMinutes = 30,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when user clicks outside or hits Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Filter only open days
  const openDays = days.filter(
    (d) => !d.isClosed && (d.availableCount > 0 || d.slots.some((s) => s.status === 'available'))
  );

  // Selected day object
  const currentDay = days.find((d) => d.date === selectedDate) || openDays[0];
  const activeDate = currentDay?.date || selectedDate;

  // All slots for the active date (both available and booked so cut-off is visible)
  const daySlots = currentDay?.slots || [];

  // Currently selected slot object
  const selectedSlot = daySlots.find((s) => s.slotKey === value);

  const formatDayLabel = (d) => {
    if (d.isToday) return `Today · ${d.dateLabel}`;
    return d.dateLabel;
  };

  if (isLoading && days.length === 0) {
    return <div className="slot-loading-msg">Loading available dates &amp; times…</div>;
  }

  if (openDays.length === 0) {
    return (
      <div className="slot-none-msg">
        No consultation dates are open right now. Please check back soon.
      </div>
    );
  }

  return (
    <div className="slot-picker-modern">
      {/* 2-Column Responsive Grid matching the other form fields */}
      <div className="slot-picker-grid">
        {/* Field 1: Preferred Date */}
        <div className="slot-picker-col">
          <label htmlFor="preferredDateSelect" className="field-label">
            Preferred Date <span className="req">*</span>
          </label>
          <div className="select-wrap">
            <span className="field-icon">
              <CalendarIcon />
            </span>
            <select
              id="preferredDateSelect"
              className="form-select-pro"
              value={activeDate}
              onChange={(e) => {
                onSelectDate(e.target.value);
                setIsOpen(false);
              }}
              suppressHydrationWarning
            >
              {openDays.map((d) => (
                <option key={d.date} value={d.date}>
                  {formatDayLabel(d)}
                </option>
              ))}
            </select>
            <span className="select-arrow">
              <ChevronDownIcon />
            </span>
          </div>
        </div>

        {/* Field 2: Preferred Time */}
        <div className="slot-picker-col">
          <label className="field-label">
            Preferred Time <span className="req">*</span>
          </label>
          <div className={`custom-select-wrap ${isOpen ? 'is-open' : ''}`} ref={dropdownRef}>
            <button
              type="button"
              id="preferredTimeTrigger"
              className={`custom-select-trigger ${selectedSlot ? 'has-value' : ''}`}
              onClick={() => setIsOpen(!isOpen)}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              suppressHydrationWarning
            >
              <span>{selectedSlot ? selectedSlot.label : 'Select Time'}</span>
            </button>

            <span className="field-icon">
              <ClockIcon />
            </span>

            <span className="select-arrow">
              <ChevronDownIcon />
            </span>

            {/* Custom Popover Dropdown Menu */}
            {isOpen && (
              <div className="custom-slot-menu" role="listbox">
                <div className="slot-menu-head">
                  <span className="slot-menu-head-title">Select Time Slot</span>
                  <span className="slot-menu-head-badge">{slotDurationMinutes} mins · 1-on-1</span>
                </div>

                <div className="slot-list">
                  {daySlots.length === 0 ? (
                    <div className="slot-none-msg">No slots for this date</div>
                  ) : (
                    daySlots.map((slot) => {
                      const isSelected = value === slot.slotKey;
                      const isBooked = slot.status === 'booked';
                      const isUnavailable = slot.status === 'unavailable' || isBooked;

                      return (
                        <button
                          type="button"
                          key={slot.slotKey}
                          className={`slot-btn ${isSelected ? 'active' : ''} ${isUnavailable ? 'is-disabled' : ''}`}
                          onClick={() => {
                            if (isUnavailable) return;
                            onChange(slot.slotKey);
                            setIsOpen(false);
                          }}
                          disabled={isUnavailable}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={isUnavailable}
                          title={isBooked ? 'This slot is already booked' : isUnavailable ? 'Unavailable' : slot.label}
                          suppressHydrationWarning
                        >
                          <span className="slot-btn-main">
                            <span className="slot-icon-wrap">
                              <ClockIcon className="slot-icon" />
                            </span>
                            <span className="slot-time">{slot.label}</span>
                          </span>

                          {isBooked ? (
                            <span className="slot-badge-booked">Booked</span>
                          ) : isUnavailable ? (
                            <span className="slot-tag">Unavailable</span>
                          ) : (
                            <span className="slot-tag">{slotDurationMinutes}m</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
