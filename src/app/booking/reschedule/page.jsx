import React from 'react';
import Link from 'next/link';
import { getCustomerRescheduleContext } from '@/features/reschedule/reschedule.service';
import { formatDateLabel, formatSlotLabel } from '@/features/schedule/slot-engine';
import CustomerReschedulePicker from '@/features/reschedule/components/CustomerReschedulePicker';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Change your consultation time — ProConnect',
  robots: { index: false, follow: false },
  // The link carries a secret token: never leak it to other sites via the Referer header
  referrer: 'no-referrer',
};

const BLOCKED_MESSAGES = {
  pending: 'We are already finding a new time for this booking. You will receive an email as soon as it is booked.',
  started: 'This consultation has already started or passed, so it can no longer be changed online.',
  limit_reached: 'This booking has already been changed the maximum number of times. Please reply to your confirmation email.',
  too_late: 'It is too close to the consultation to change it online. Please reply to your confirmation email.',
};

/** Customer page behind the "Choose another time" link in booking emails */
export default async function CustomerReschedulePage({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === 'string' ? params.token : '';
  const context = token ? await getCustomerRescheduleContext(token) : { ok: false };

  return (
    <div className="reschedule-page">
      <div className="reschedule-card">
        <h1 className="reschedule-title">Change your consultation time</h1>

        {!context.ok ? (
          <>
            <p className="reschedule-text">This link is invalid or has expired. Please use the latest email we sent you, or reply to it.</p>
            <Link href="/" className="btn-pro btn-dark w-100 justify-content-center">
              Back to homepage
            </Link>
          </>
        ) : (
          <>
            <div className="reschedule-current">
              <span>Current booking</span>
              <strong>
                {formatDateLabel(context.booking.consultationDate)}, {formatSlotLabel(context.booking.slotStartTime, context.booking.slotEndTime)}
              </strong>
              <span>
                {context.booking.fullName} · Ref {context.booking.bookingId.slice(0, 8).toUpperCase()}
              </span>
            </div>

            {context.canReschedule ? (
              <>
                <p className="reschedule-text">
                  Pick any open time below. Your payment carries over — nothing more to pay.
                  {context.changesLeft === 1 ? ' You can change it once more.' : ` You can change it ${context.changesLeft} more times.`}
                  {` Changes are possible up to ${context.cutoffHours} hours before the consultation.`}
                </p>
                <CustomerReschedulePicker token={token} />
              </>
            ) : (
              <p className="reschedule-text">{BLOCKED_MESSAGES[context.blockedReason]}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
