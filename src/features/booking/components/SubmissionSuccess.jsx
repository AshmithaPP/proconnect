import React from 'react';
import { CheckCircleIcon, DocumentSummaryIcon } from '@/components/ui/Icons';
import { formatAmount } from '@/features/payments/format-amount';

export default function SubmissionSuccess({ data, onReset }) {
  const {
    fullName,
    companyName,
    workEmail,
    phoneNumber,
    role,
    roleOther,
    teamSize,
    challenge,
    challengeOther,
    timeSlot,
    booking,
  } = data;

  const isPaid = booking?.payment?.paymentStatus === 'paid';

  const roleDisplay = role === 'Other' && roleOther ? `Other (${roleOther})` : role || '—';
  const challengeDisplay =
    challenge === 'Other' && challengeOther ? `Other (${challengeOther})` : challenge || '—';
  const teamDisplay = teamSize || 'Not specified';

  return (
    <div className="form-success-card">
      <div className="form-success-icon">
        <CheckCircleIcon />
      </div>

      <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--brand-black)', marginBottom: '8px' }}>
        {isPaid ? 'Booking Confirmed!' : 'Thank You! Request Received.'}
      </h3>

      <p style={{ maxWidth: '480px', margin: '0 auto', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
        We&apos;ll review your business details and get back to you shortly to schedule our sales strategy session.
      </p>

      <div className="summary-container">
        <div className="summary-head">
          <DocumentSummaryIcon />
          BUSINESS SALES CONSULTATION FORM
        </div>

        {booking?.bookingId && (
          <div className="summary-row">
            <span className="summary-key">Booking ID:</span>
            <span className="summary-val">{booking.bookingId}</span>
          </div>
        )}

        {booking?.payment && (
          <div className="summary-row">
            <span className="summary-key">Payment:</span>
            <span className="summary-val">
              {isPaid
                ? `Paid · ${formatAmount(booking.payment.amountPaise, booking.payment.currencyCode)}`
                : 'Pending'}
            </span>
          </div>
        )}

        <div className="summary-row">
          <span className="summary-key">Name:</span>
          <span className="summary-val">{fullName || '—'}</span>
        </div>

        <div className="summary-row">
          <span className="summary-key">Company:</span>
          <span className="summary-val">{companyName || '—'}</span>
        </div>

        <div className="summary-row">
          <span className="summary-key">Email:</span>
          <span className="summary-val">{workEmail || '—'}</span>
        </div>

        <div className="summary-row">
          <span className="summary-key">Phone:</span>
          <span className="summary-val">{phoneNumber || '—'}</span>
        </div>

        <div className="summary-row">
          <span className="summary-key">Role:</span>
          <span className="summary-val">{roleDisplay}</span>
        </div>

        <div className="summary-row">
          <span className="summary-key">Sales team size:</span>
          <span className="summary-val">{teamDisplay}</span>
        </div>

        <div className="summary-row">
          <span className="summary-key">Biggest sales challenge:</span>
          <span className="summary-val">{challengeDisplay}</span>
        </div>

        <div className="summary-row">
          <span className="summary-key">Time slot:</span>
          <span className="summary-val">{timeSlot || '—'}</span>
        </div>
      </div>

      <div className="mt-4 pt-2">
        <button
          type="button"
          onClick={onReset}
          className="btn-pro btn-dark"
          style={{ fontSize: '0.85rem', padding: '12px 26px' }}
        >
          Submit Another Inquiry
        </button>
      </div>
    </div>
  );
}
