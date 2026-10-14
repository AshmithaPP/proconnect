'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ClockIcon, ChevronDownIcon } from '@/components/icons/Icons';
import { TIME_SLOTS } from '@/lib/booking/options';

export default function TimeSlotPicker({ value, onChange, unavailableSlots = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
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

  const handleSelect = (slot) => {
    if (unavailableSlots.includes(slot)) return;
    onChange(slot);
    setIsOpen(false);
  };

  return (
    <div className={`custom-select-wrap ${isOpen ? 'is-open' : ''}`} ref={containerRef}>
      <button
        type="button"
        className={`custom-select-trigger ${value ? 'has-value' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{value || 'Select'}</span>
      </button>

      <span className="field-icon">
        <ClockIcon />
      </span>

      <span className="select-arrow">
        <ChevronDownIcon />
      </span>

      {isOpen && (
        <div className="custom-slot-menu" role="listbox">
          <div className="slot-menu-head">
            <span className="slot-menu-head-title">Select Time Slot</span>
            <span className="slot-menu-head-badge">30 mins · 1-on-1</span>
          </div>
          <div className="slot-list">
            {TIME_SLOTS.map((slot) => {
              const isSelected = value === slot;
              const isUnavailable = unavailableSlots.includes(slot);

              return (
                <button
                  type="button"
                  key={slot}
                  className={`slot-btn ${isSelected ? 'active' : ''} ${isUnavailable ? 'slot-disabled' : ''}`}
                  onClick={() => handleSelect(slot)}
                  disabled={isUnavailable}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isUnavailable}
                  title={isUnavailable ? 'This time slot is already booked' : slot}
                  style={
                    isUnavailable
                      ? {
                          opacity: 0.5,
                          cursor: 'not-allowed',
                          backgroundColor: '#f1f5f9',
                          pointerEvents: 'auto',
                        }
                      : {}
                  }
                >
                  <span className="slot-btn-main">
                    <span className="slot-icon-wrap">
                      <ClockIcon className="slot-icon" />
                    </span>
                    <span
                      className="slot-time"
                      style={isUnavailable ? { textDecoration: 'line-through', color: '#94a3b8' } : {}}
                    >
                      {slot}
                    </span>
                  </span>
                  <span
                    className="slot-tag"
                    style={
                      isUnavailable
                        ? {
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            fontWeight: '700',
                          }
                        : {}
                    }
                  >
                    {isUnavailable ? 'Booked' : '30m'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
