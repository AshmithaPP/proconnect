'use client';

import React, { useEffect, useState } from 'react';
import SlotCalendarPicker from '@/features/booking/components/SlotCalendarPicker';

/**
 * Customer picks a new time (from the link in their email). Uses the same public calendar as
 * the booking form; the server re-checks everything.
 * @param {{ token: string }} props
 */
export default function CustomerReschedulePicker({ token }) {
  const [availability, setAvailability] = useState({ days: [], slotDurationMinutes: 30 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [slotKey, setSlotKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const load = async () => {
    try {
      const res = await fetch('/api/bookings/availability', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setAvailability({ days: data.days, slotDurationMinutes: data.slotDurationMinutes });
        setSelectedDate((current) => current || (data.days.find((d) => d.availableCount > 0) || data.days[0])?.date || '');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async () => {
    if (!slotKey) {
      setError('Please choose a new time.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/bookings/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slotKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not change your booking.');
        setSlotKey('');
        load();
      } else {
        setDone(data.newTime);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="reschedule-done" role="status">
        <strong>Done — your consultation is now on {done}.</strong>
        <span>A confirmation email is on its way.</span>
      </div>
    );
  }

  return (
    <div className="reschedule-picker">
      <SlotCalendarPicker
        days={availability.days}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        value={slotKey}
        onChange={setSlotKey}
        isLoading={isLoading}
        slotDurationMinutes={availability.slotDurationMinutes}
      />
      {error && <div className="form-alert">{error}</div>}
      <button type="button" className="btn-pro btn-orange w-100 justify-content-center" onClick={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Confirm new time'}
      </button>
    </div>
  );
}
