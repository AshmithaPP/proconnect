import React from 'react';
import Link from 'next/link';
import { CheckCircleIcon } from '@/components/ui/Icons';
import { getBookingById } from '@/features/booking/booking.repository';
import { formatAmount } from '@/features/payments/format-amount';
import { reconcileWorldlineBooking } from '@/features/payments/worldline.reconcile';
import { formatDateLabel, formatSlotLabel } from '@/features/schedule/slot-engine';
import { listBookingReschedules } from '@/features/reschedule/reschedule.repository';
import { RESCHEDULE_REASON_TEXT } from '@/features/email/booking-emails';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payment Status — ProConnect',
  robots: { index: false, follow: false },
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Payment result page. The outcome shown is read from the DATABASE, never trusted from
 * the query string — a crafted "?status=success" cannot display a fake confirmation.
 * The query string only supplies the booking ID and an optional failure reason.
 */
export default async function PaymentStatusPage({ searchParams }) {
  const params = await searchParams;
  const bookingIdParam = typeof params?.bookingId === 'string' ? params.bookingId : '';
  const requestedStatus = typeof params?.status === 'string' ? params.status : '';
  const reasonCode = typeof params?.reason === 'string' ? params.reason : '';
  // Gateway / internal codes → customer-friendly text
  const reason = reasonCode.includes('REJECTED')
    ? 'The payment was declined. Please try again with another card.'
    : reasonCode === 'amount_mismatch' || reasonCode === 'booking_cancelled'
    ? 'We could not confirm this payment automatically. Our team will contact you shortly.'
    : reasonCode
    ? 'The payment could not be completed. Please try again.'
    : '';

  let booking = UUID_REGEX.test(bookingIdParam) ? await getBookingById(bookingIdParam) : null;

  // Still pending → ask Worldline again, so refreshing this page picks up a completed payment
  if (booking?.status === 'pending' && booking.payment?.paymentProvider === 'worldline' && booking.payment.providerOrderId) {
    try {
      await reconcileWorldlineBooking(booking);
      booking = await getBookingById(booking.bookingId);
    } catch (err) {
      console.error('[Payment Status] Worldline re-check failed:', err.message);
    }
  }

  // paid | reschedule_required | pending | cancelled | no_payment | null (unknown booking)
  const dbStatus = booking?.status || null;
  const isSuccess = dbStatus === 'paid';
  // Paid, but no free slot yet to move it to (it is booked automatically as soon as one opens)
  const isReschedule = dbStatus === 'reschedule_required';
  // Paid and automatically moved because its slot was taken a moment earlier
  const autoMove = isSuccess
    ? (await listBookingReschedules(booking.bookingId)).find((move) => move.reason === 'slot_taken' && move.rescheduledBy === 'system')
    : null;
  const isProcessing = dbStatus === 'pending' && requestedStatus === 'processing';
  const isCancelled = dbStatus === 'cancelled' && requestedStatus === 'cancelled';
  const bookingId = booking?.bookingId || '';
  const paymentId = isSuccess || isReschedule ? booking.payment.providerPaymentId || '' : '';
  const consultationLabel = booking?.consultationDate
    ? `${formatDateLabel(booking.consultationDate)}, ${booking.preferredTimeSlot}`
    : '';
  const amountLabel = booking?.payment
    ? `${formatAmount(booking.payment.amountPaise, booking.payment.currencyCode)} ${booking.payment.currencyCode}`
    : '—';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Status Icon */}
        <div style={styles.iconWrap}>
          {isSuccess ? (
            <div style={styles.successIcon}>
              <CheckCircleIcon />
            </div>
          ) : isCancelled || isProcessing || isReschedule ? (
            <div style={styles.cancelledIcon}>{isProcessing || isReschedule ? '⏳' : '⊘'}</div>
          ) : (
            <div style={styles.failedIcon}>✗</div>
          )}
        </div>

        {/* Header */}
        <h1 style={styles.title}>
          {isSuccess
            ? 'Consultation Booking Confirmed!'
            : isReschedule
            ? 'Payment Received — Finding Your New Time'
            : isProcessing
            ? 'Payment Processing'
            : isCancelled
            ? 'Payment Cancelled'
            : 'Payment Not Completed'}
        </h1>

        <p style={styles.subtitle}>
          {isSuccess
            ? autoMove
              ? `Your payment was verified with Worldline. ${RESCHEDULE_REASON_TEXT.slot_taken} The new time is below — it has been emailed to you too.`
              : 'Your payment was successfully verified with Worldline. A confirmation has been registered.'
            : isReschedule
            ? 'Your payment was successful, but your chosen time was booked by someone else moments before and no other slot is free yet. Your payment is safe — we will book the next free slot for you automatically and email you the new time.'
            : isProcessing
            ? 'Worldline has not confirmed your payment yet. Please refresh this page in a minute — do not pay again.'
            : isCancelled
            ? 'The payment session was cancelled. You can retry anytime to reserve your consultation slot.'
            : reason
            ? reason
            : 'We were unable to verify your payment with Worldline. Please try again or contact support.'}
        </p>

        {/* Receipt Details Box */}
        {bookingId && (
          <div style={styles.receiptBox}>
            <div style={styles.receiptRow}>
              <span style={styles.receiptLabel}>Booking Reference:</span>
              <span style={styles.receiptValue}>{bookingId.slice(0, 8)}...</span>
            </div>
            <div style={styles.receiptRow}>
              <span style={styles.receiptLabel}>Payment Gateway:</span>
              <span style={styles.receiptValue}>Worldline Connect</span>
            </div>
            {consultationLabel && (
              <div style={styles.receiptRow}>
                <span style={styles.receiptLabel}>{autoMove ? 'New time:' : 'Consultation:'}</span>
                <span style={styles.receiptValue}>{consultationLabel}</span>
              </div>
            )}
            {autoMove && (
              <div style={styles.receiptRow}>
                <span style={styles.receiptLabel}>Originally chosen:</span>
                <span style={{ ...styles.receiptValue, textDecoration: 'line-through', opacity: 0.6 }}>
                  {formatDateLabel(autoMove.previous.date)}, {formatSlotLabel(autoMove.previous.startTime, autoMove.previous.endTime)}
                </span>
              </div>
            )}
            {paymentId && (
              <div style={styles.receiptRow}>
                <span style={styles.receiptLabel}>Worldline Transaction ID:</span>
                <span style={styles.receiptValue}>{paymentId}</span>
              </div>
            )}
            <div style={styles.receiptRow}>
              <span style={styles.receiptLabel}>Amount:</span>
              <span style={styles.receiptValue}>{amountLabel}</span>
            </div>
            <div style={styles.receiptRow}>
              <span style={styles.receiptLabel}>Status:</span>
              <span
                style={{
                  ...styles.statusBadge,
                  ...(isSuccess || isReschedule ? styles.statusBadgeSuccess : styles.statusBadgeFailed),
                }}
              >
                {isSuccess ? 'PAID & CONFIRMED' : isReschedule ? 'PAID · FINDING A NEW TIME' : isProcessing ? 'PROCESSING' : isCancelled ? 'CANCELLED' : 'FAILED'}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={styles.actionGroup}>
          {isSuccess || isReschedule ? (
            <Link href="/" style={styles.primaryBtn}>
              Return to Homepage
            </Link>
          ) : (
            <>
              <Link href="/#book" style={styles.primaryBtn}>
                Retry Booking Payment
              </Link>
              <Link href="/" style={styles.secondaryBtn}>
                Back to Homepage
              </Link>
            </>
          )}
        </div>

        {/* Guarantees */}
        <div style={styles.footerNote}>
          <span>🔒 256-Bit SSL Encrypted Verification</span>
          <span>•</span>
          <span>Worldline Pre-Production</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '40px 32px',
    maxWidth: '540px',
    width: '100%',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    textAlign: 'center',
  },
  iconWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  successIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#dcfce7',
    color: '#16a34a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
  },
  cancelledIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#f1f5f9',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    fontWeight: 'bold',
  },
  failedIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#fee2e2',
    color: '#dc2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    fontWeight: 'bold',
  },
  title: {
    fontSize: '1.45rem',
    fontWeight: '800',
    color: '#002D62',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontSize: '0.94rem',
    color: '#64748b',
    lineHeight: '1.5',
    margin: '0 0 24px 0',
  },
  receiptBox: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '16px 20px',
    textAlign: 'left',
    marginBottom: '28px',
  },
  receiptRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '7px 0',
    fontSize: '0.88rem',
    borderBottom: '1px solid #f1f5f9',
  },
  receiptLabel: {
    color: '#64748b',
  },
  receiptValue: {
    fontWeight: '600',
    color: '#0f172a',
  },
  statusBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '0.78rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  statusBadgeSuccess: {
    background: '#dcfce7',
    color: '#16a34a',
  },
  statusBadgeFailed: {
    background: '#fee2e2',
    color: '#dc2626',
  },
  actionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  primaryBtn: {
    display: 'block',
    padding: '14px 20px',
    background: '#002D62',
    color: '#ffffff',
    borderRadius: '8px',
    fontWeight: '700',
    textDecoration: 'none',
    fontSize: '0.96rem',
    transition: 'background 0.2s',
  },
  secondaryBtn: {
    display: 'block',
    padding: '12px 20px',
    background: '#f1f5f9',
    color: '#334155',
    borderRadius: '8px',
    fontWeight: '600',
    textDecoration: 'none',
    fontSize: '0.9rem',
  },
  footerNote: {
    marginTop: '24px',
    fontSize: '0.76rem',
    color: '#94a3b8',
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
  },
};
