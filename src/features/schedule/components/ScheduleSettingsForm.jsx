'use client';

import React from 'react';
import Link from 'next/link';
import FormField from '@/components/portal/form/FormField';
import FormStatus from '@/components/portal/form/FormStatus';
import useJsonSubmit from '@/components/portal/form/useJsonSubmit';
import { timeToMinutes, formatTimeLabel, SLOT_MINUTES } from '@/features/schedule/slot-engine';

/**
 * Consultant schedule: fee and booking window. Hours and 30-minute slots are fixed.
 * Business hours are fixed (same every day); days off are set on the Availability page.
 * Saves to PUT /api/consultant/schedule.
 *
 * @param {{ initialRules: object, businessHours: Array<{ startTime: string, endTime: string }>, timezone: string, availabilityPath: string }} props
 */
export default function ScheduleSettingsForm({ initialRules, businessHours, timezone, availabilityPath }) {
  const [rules, setRules] = React.useState({
    consultationFeeRupees: String(initialRules.consultationFeePaise / 100),
    bookingWindowDays: String(initialRules.bookingWindowDays),
  });
  const [warning, setWarning] = React.useState('');
  const { submit, isSubmitting, status, fieldErrors } = useJsonSubmit();

  const setRule = (name, value) => setRules((prev) => ({ ...prev, [name]: value }));
  const duration = SLOT_MINUTES;
  const slotsPerDay = businessHours.reduce(
    (total, range) => total + Math.floor((timeToMinutes(range.endTime) - timeToMinutes(range.startTime)) / duration),
    0
  );
  const hoursText = businessHours
    .map((range) => `${formatTimeLabel(timeToMinutes(range.startTime))} – ${formatTimeLabel(timeToMinutes(range.endTime))}`)
    .join(' and ');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setWarning('');
    const { ok, data } = await submit(
      '/api/consultant/schedule',
      'PUT',
      {
        rules: {
          consultationFeeRupees: Number(rules.consultationFeeRupees),
          bookingWindowDays: Number(rules.bookingWindowDays),
        },
      },
      'Saved — customers see the change immediately'
    );
    if (ok && data.bookingsOutsideHours) {
      setWarning(
        `${data.bookingsOutsideHours} upcoming paid booking${data.bookingsOutsideHours === 1 ? ' does' : 's do'} not line up with the new slot length. ${data.bookingsOutsideHours === 1 ? 'It is' : 'They are'} kept and still shown in Availability.`
      );
    }
  };

  return (
    <form className="admin-dashboard-full" style={{ gap: 20 }} onSubmit={handleSubmit} noValidate>
      <section className="settings-card">
        <h2 className="settings-card-title">Pricing &amp; booking</h2>
        <p className="settings-card-subtitle">Apply to new bookings only — existing bookings keep their price and time.</p>
        <div className="settings-grid">
          <FormField
            name="consultationFeeRupees"
            label="Consultation fee (₹)"
            required
            value={rules.consultationFeeRupees}
            onChange={(name, value) => setRule(name, value.replace(/[^\d.]/g, ''))}
            error={fieldErrors.consultationFeeRupees}
            hint="What the customer pays on Worldline for one consultation."
            disabled={isSubmitting}
          />
          <FormField
            name="bookingWindowDays"
            type="number"
            label="Booking window (days)"
            required
            value={rules.bookingWindowDays}
            onChange={setRule}
            error={fieldErrors.bookingWindowDays}
            hint="How many days customers can book ahead, counting today. 7 = today + the next 6 days."
            disabled={isSubmitting}
          />
        </div>
        <p className="field-hint" style={{ marginTop: 18 }}>
          <strong>Hours:</strong> every day, {hoursText} ({timezone}) — {slotsPerDay} consultations of {duration} minutes. To take a day or time off, use{' '}
          <Link href={availabilityPath}>Availability</Link>.
        </p>
      </section>

      <div className="settings-actions" style={{ marginTop: 0 }}>
        <button type="submit" className="btn-pro btn-orange btn-sm" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
        <FormStatus status={status} />
      </div>
      {warning && <div className="form-status error">{warning}</div>}
    </form>
  );
}
