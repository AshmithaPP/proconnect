'use client';

import React, { useMemo, useState } from 'react';
import FormField from '@/components/portal/form/FormField';
import FormStatus from '@/components/portal/form/FormStatus';
import useJsonSubmit from '@/components/portal/form/useJsonSubmit';
import { WEEKDAY_NAMES, timeToMinutes } from '@/features/schedule/slot-engine';

const NOTICE_OPTIONS = [
  [0, 'No minimum'], [30, '30 minutes'], [60, '1 hour'], [120, '2 hours'], [240, '4 hours'],
  [720, '12 hours'], [1440, '1 day'], [2880, '2 days'],
];
const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90, 120];
const GAP_OPTIONS = [0, 5, 10, 15, 30];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

const toOptions = (pairs) => pairs.map(([value, label]) => ({ value: String(value), label }));

/** Slots a set of ranges produces with the given length/gap */
function countSlots(ranges, duration, gap) {
  return ranges.reduce((total, range) => {
    const span = timeToMinutes(range.endTime) - timeToMinutes(range.startTime);
    return span >= duration ? total + Math.floor((span - duration) / (duration + gap)) + 1 : total;
  }, 0);
}

/**
 * Consultant schedule: fee + booking rules + weekly hours. Saves to PUT /api/consultant/schedule.
 * @param {{ initialRules: object, initialWeeklyHours: Array<{ weekday: number, startTime: string, endTime: string }>, timezone: string }} props
 */
export default function ScheduleSettingsForm({ initialRules, initialWeeklyHours, timezone }) {
  const [rules, setRules] = useState({
    consultationFeeRupees: String(initialRules.consultationFeePaise / 100),
    bookingWindowDays: String(initialRules.bookingWindowDays),
    minNoticeMinutes: String(initialRules.minNoticeMinutes),
    slotDurationMinutes: String(initialRules.slotDurationMinutes),
    slotGapMinutes: String(initialRules.slotGapMinutes),
  });
  const [hours, setHours] = useState(() =>
    Object.fromEntries(WEEK_ORDER.map((weekday) => [weekday, initialWeeklyHours.filter((h) => h.weekday === weekday).map(({ startTime, endTime }) => ({ startTime, endTime }))]))
  );
  const [warning, setWarning] = useState('');
  const { submit, isSubmitting, status, fieldErrors } = useJsonSubmit();

  const duration = Number(rules.slotDurationMinutes);
  const gap = Number(rules.slotGapMinutes);
  const weeklySlots = useMemo(() => WEEK_ORDER.reduce((sum, weekday) => sum + countSlots(hours[weekday], duration, gap), 0), [hours, duration, gap]);

  const setRule = (name, value) => setRules((prev) => ({ ...prev, [name]: value }));
  const updateRange = (weekday, index, field, value) =>
    setHours((prev) => ({ ...prev, [weekday]: prev[weekday].map((r, i) => (i === index ? { ...r, [field]: value } : r)) }));
  const addRange = (weekday) =>
    setHours((prev) => {
      const last = prev[weekday][prev[weekday].length - 1];
      const start = last ? last.endTime : '10:00';
      const startMinutes = Math.min(timeToMinutes(start) + 60, 23 * 60);
      const end = `${String(Math.floor(Math.min(startMinutes + 120, 23 * 60 + 59) / 60)).padStart(2, '0')}:${String(Math.min(startMinutes + 120, 23 * 60 + 59) % 60).padStart(2, '0')}`;
      const begin = `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`;
      return { ...prev, [weekday]: [...prev[weekday], last ? { startTime: begin, endTime: end } : { startTime: '10:00', endTime: '13:00' }] };
    });
  const removeRange = (weekday, index) => setHours((prev) => ({ ...prev, [weekday]: prev[weekday].filter((_, i) => i !== index) }));
  const copyToWeekdays = (weekday) =>
    setHours((prev) => ({ ...prev, ...Object.fromEntries([1, 2, 3, 4, 5].map((d) => [d, prev[weekday].map((r) => ({ ...r }))])) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setWarning('');
    const weeklyHours = WEEK_ORDER.flatMap((weekday) => hours[weekday].map((r) => ({ weekday, ...r })));
    const { ok, data } = await submit(
      '/api/consultant/schedule',
      'PUT',
      {
        rules: {
          consultationFeeRupees: Number(rules.consultationFeeRupees),
          bookingWindowDays: Number(rules.bookingWindowDays),
          minNoticeMinutes: Number(rules.minNoticeMinutes),
          slotDurationMinutes: Number(rules.slotDurationMinutes),
          slotGapMinutes: Number(rules.slotGapMinutes),
        },
        weeklyHours,
      },
      'Schedule saved — customers see the new slots immediately'
    );
    if (ok && data.bookingsOutsideHours) {
      setWarning(
        `${data.bookingsOutsideHours} upcoming paid booking${data.bookingsOutsideHours === 1 ? ' is' : 's are'} now outside your hours. ${data.bookingsOutsideHours === 1 ? 'It is' : 'They are'} kept and still shown in Availability.`
      );
    }
  };

  return (
    <form className="admin-dashboard-full" style={{ gap: 20 }} onSubmit={handleSubmit} noValidate>
      <section className="settings-card">
        <h2 className="settings-card-title">Pricing &amp; booking rules</h2>
        <p className="settings-card-subtitle">Apply to new bookings only — existing bookings keep their price and time.</p>
        <div className="settings-grid">
          <FormField
            name="consultationFeeRupees"
            label="Consultation fee (₹)"
            required
            value={rules.consultationFeeRupees}
            onChange={(name, value) => setRule(name, value.replace(/[^\d.]/g, ''))}
            error={fieldErrors.consultationFeeRupees}
            hint="Charged on Worldline when the customer books."
            disabled={isSubmitting}
          />
          <FormField
            name="bookingWindowDays"
            type="number"
            label="Booking window (days ahead)"
            required
            value={rules.bookingWindowDays}
            onChange={setRule}
            error={fieldErrors.bookingWindowDays}
            hint="Customers can book from today up to this many days (today counts as day 1)."
            disabled={isSubmitting}
          />
          <FormField
            name="slotDurationMinutes"
            type="select"
            label="Slot length"
            options={DURATION_OPTIONS.map((m) => ({ value: String(m), label: `${m} minutes` }))}
            value={rules.slotDurationMinutes}
            onChange={setRule}
            error={fieldErrors.slotDurationMinutes}
            disabled={isSubmitting}
          />
          <FormField
            name="slotGapMinutes"
            type="select"
            label="Break between slots"
            options={GAP_OPTIONS.map((m) => ({ value: String(m), label: m ? `${m} minutes` : 'No break' }))}
            value={rules.slotGapMinutes}
            onChange={setRule}
            error={fieldErrors.slotGapMinutes}
            disabled={isSubmitting}
          />
          <FormField
            name="minNoticeMinutes"
            type="select"
            label="Minimum notice"
            options={toOptions(NOTICE_OPTIONS)}
            value={rules.minNoticeMinutes}
            onChange={setRule}
            error={fieldErrors.minNoticeMinutes}
            hint="How soon before a slot it can still be booked."
            disabled={isSubmitting}
          />
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-card-title">Weekly hours</h2>
        <p className="settings-card-subtitle">
          When you take consultations ({timezone}). Add several ranges for breaks. {weeklySlots} slots per week with the current settings.
        </p>
        {fieldErrors.weeklyHours && <div className="form-status error" style={{ marginBottom: 12 }}>{fieldErrors.weeklyHours}</div>}

        <div className="weekly-hours">
          {WEEK_ORDER.map((weekday) => {
            const ranges = hours[weekday];
            return (
              <div key={weekday} className="weekly-day">
                <div className="weekly-day-name">
                  <strong>{WEEKDAY_NAMES[weekday]}</strong>
                  <span className="field-hint" style={{ marginTop: 2 }}>
                    {ranges.length ? `${countSlots(ranges, duration, gap)} slots` : 'Closed'}
                  </span>
                </div>
                <div className="weekly-day-ranges">
                  {ranges.length === 0 && <span className="weekly-closed">Not available</span>}
                  {ranges.map((range, index) => (
                    <div key={index} className="weekly-range">
                      <input
                        type="time"
                        className="form-control-pro no-icon"
                        value={range.startTime}
                        onChange={(e) => updateRange(weekday, index, 'startTime', e.target.value)}
                        aria-label={`${WEEKDAY_NAMES[weekday]} range ${index + 1} start`}
                        disabled={isSubmitting}
                      />
                      <span aria-hidden="true">–</span>
                      <input
                        type="time"
                        className="form-control-pro no-icon"
                        value={range.endTime}
                        onChange={(e) => updateRange(weekday, index, 'endTime', e.target.value)}
                        aria-label={`${WEEKDAY_NAMES[weekday]} range ${index + 1} end`}
                        disabled={isSubmitting}
                      />
                      <button type="button" className="link-button danger" onClick={() => removeRange(weekday, index)} disabled={isSubmitting}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="weekly-day-actions">
                  <button type="button" className="link-button" onClick={() => addRange(weekday)} disabled={isSubmitting}>
                    + Add hours
                  </button>
                  {weekday === 1 && ranges.length > 0 && (
                    <button type="button" className="link-button" onClick={() => copyToWeekdays(1)} disabled={isSubmitting}>
                      Copy to Tue–Fri
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="settings-actions" style={{ marginTop: 0 }}>
        <button type="submit" className="btn-pro btn-orange btn-sm" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save schedule'}
        </button>
        <FormStatus status={status} />
      </div>
      {warning && <div className="form-status error">{warning}</div>}
    </form>
  );
}
