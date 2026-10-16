'use client';

import React from 'react';
import SlotCalendarPicker from './SlotCalendarPicker';
import FormTextField from './FormTextField';
import FormSelectField from './FormSelectField';
import BookingTrustBadges from './BookingTrustBadges';
import useBookingForm from '@/features/booking/hooks/useBookingForm';
import {
  FiUser,
  FiBriefcase,
  FiMail,
  FiPhone,
  FiUsers,
  FiLayers,
  FiTarget,
  FiArrowRight,
  FiCheckCircle,
} from 'react-icons/fi';
import {
  USER_ROLE_OPTIONS,
  SALES_TEAM_SIZE_OPTIONS,
  SALES_CHALLENGE_OPTIONS,
} from '@/features/booking/booking.options';
import { formatAmount } from '@/features/payments/format-amount';

function GoogleLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'inline-block' }}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function BookingForm({ onSuccess }) {
  const {
    formData,
    errorMessage,
    isSubmitting,
    availability,
    isLoadingSlots,
    selectedDate,
    googleUser,
    handleGoogleDisconnect,
    handleDateChange,
    handleChange,
    handleSlotChange,
    handleSubmit,
  } = useBookingForm(onSuccess);

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Continue with Google (Shown only when not authenticated) */}
      {!googleUser && (
        <div style={{ marginBottom: '18px' }}>
          <a
            href="/api/auth/google/customer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              padding: '11px 16px',
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '8px',
              color: '#0f172a',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            <GoogleLogo size={18} />
            <span>Continue with Google</span>
            <span
              style={{
                fontSize: '0.72rem',
                background: '#eff6ff',
                color: '#2563eb',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '999px',
              }}
            >
              1-Click Sync
            </span>
          </a>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '14px 0 6px 0',
              gap: '10px',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
            <span
              style={{
                fontSize: '0.7rem',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 600,
              }}
            >
              or fill details manually
            </span>
            <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
          </div>
        </div>
      )}

      <div className="form-grid">
        <FormTextField
          id="fullName"
          name="fullName"
          label="Full Name"
          icon={<FiUser />}
          value={formData.fullName}
          onChange={handleChange}
          placeholder="e.g. Cynthia Vance"
        />

        <FormTextField
          id="companyName"
          name="companyName"
          label="Company Name"
          icon={<FiBriefcase />}
          value={formData.companyName}
          onChange={handleChange}
          placeholder="e.g. Acme Corp"
        />

        <FormTextField
          id="workEmail"
          name="workEmail"
          label="Work Email"
          type="email"
          icon={googleUser ? <GoogleLogo size={16} /> : <FiMail />}
          value={formData.workEmail}
          onChange={handleChange}
          placeholder="name@company.com"
          readOnly={Boolean(googleUser)}
          badge={
            googleUser ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    background: '#dcfce7',
                    color: '#15803d',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 4,
                  }}
                >
                  <FiCheckCircle size={11} /> Verified
                </span>
                <button
                  type="button"
                  onClick={handleGoogleDisconnect}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = '#dc2626')}
                  onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
                >
                  (Change)
                </button>
              </span>
            ) : null
          }
          helperText={googleUser ? 'Verified via Google. Meeting invite will be sent here.' : null}
        />

        <FormTextField
          id="phoneNumber"
          name="phoneNumber"
          label="Phone Number"
          type="tel"
          icon={<FiPhone />}
          value={formData.phoneNumber}
          onChange={handleChange}
          placeholder="+91 98765 43210"
        />

        <FormSelectField
          id="userRole"
          name="role"
          label="Your Role"
          required
          icon={<FiUsers />}
          value={formData.role}
          onChange={handleChange}
          options={USER_ROLE_OPTIONS}
          otherField={{
            id: 'roleOtherInput',
            name: 'roleOther',
            value: formData.roleOther,
            placeholder: 'Specify your role',
          }}
        />

        <FormSelectField
          id="teamSize"
          name="teamSize"
          label="Current Sales Team Size"
          icon={<FiLayers />}
          value={formData.teamSize}
          onChange={handleChange}
          options={SALES_TEAM_SIZE_OPTIONS}
        />

        <FormSelectField
          id="salesChallenge"
          name="challenge"
          label="What Is Your Biggest Sales Challenge?"
          required
          className="col-full"
          icon={<FiTarget />}
          value={formData.challenge}
          onChange={handleChange}
          options={SALES_CHALLENGE_OPTIONS}
          otherField={{
            id: 'challengeOtherInput',
            name: 'challengeOther',
            value: formData.challengeOther,
            placeholder: 'Describe your sales challenge',
          }}
        />

        {/* Preferred Date & Time Selector */}
        <div className="col-full">
          <SlotCalendarPicker
            days={availability.days}
            selectedDate={selectedDate}
            onSelectDate={handleDateChange}
            value={formData.slotKey}
            onChange={handleSlotChange}
            isLoading={isLoadingSlots}
            slotDurationMinutes={availability.slotDurationMinutes}
          />
        </div>
      </div>

      {/* Validation Error Message */}
      {errorMessage && <div className="form-alert">{errorMessage}</div>}

      {/* Submit Button */}
      <div className="mt-4">
        <button
          type="submit"
          className="btn-pro btn-orange w-100 justify-content-center"
          disabled={isSubmitting}
          suppressHydrationWarning
          style={{
            fontSize: '1rem',
            padding: '15px 28px',
            opacity: isSubmitting ? 0.75 : 1,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          <span>{isSubmitting ? 'Connecting to Secure Worldline Checkout...' : `Proceed to Worldline Payment${availability.fee ? ` (${formatAmount(availability.fee.amountPaise, availability.fee.currencyCode)})` : ''}`}</span>
          {!isSubmitting && <FiArrowRight />}
        </button>
      </div>

      <BookingTrustBadges />
    </form>
  );
}
