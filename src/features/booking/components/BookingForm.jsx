'use client';

import React from 'react';
import SlotCalendarPicker from './SlotCalendarPicker';
import FormTextField from './FormTextField';
import FormSelectField from './FormSelectField';
import BookingTrustBadges from './BookingTrustBadges';
import useBookingForm from '@/features/booking/hooks/useBookingForm';
import {
  UserIcon,
  BuildingIcon,
  MailIcon,
  PhoneIcon,
  UserRoleIcon,
  TeamSizeIcon,
  TargetIcon,
  ArrowRightIcon,
} from '@/components/ui/Icons';
import {
  USER_ROLE_OPTIONS,
  SALES_TEAM_SIZE_OPTIONS,
  SALES_CHALLENGE_OPTIONS,
} from '@/features/booking/booking.options';
import { formatAmount } from '@/features/payments/format-amount';

export default function BookingForm({ onSuccess }) {
  const {
    formData,
    errorMessage,
    isSubmitting,
    availability,
    isLoadingSlots,
    selectedDate,
    handleDateChange,
    handleChange,
    handleSlotChange,
    handleSubmit,
  } = useBookingForm(onSuccess);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <FormTextField
          id="fullName"
          name="fullName"
          label="Full Name"
          icon={<UserIcon />}
          value={formData.fullName}
          onChange={handleChange}
          placeholder="e.g. Cynthia Vance"
        />

        <FormTextField
          id="companyName"
          name="companyName"
          label="Company Name"
          icon={<BuildingIcon />}
          value={formData.companyName}
          onChange={handleChange}
          placeholder="e.g. Acme Corp"
        />

        <FormTextField
          id="workEmail"
          name="workEmail"
          label="Work Email"
          type="email"
          icon={<MailIcon />}
          value={formData.workEmail}
          onChange={handleChange}
          placeholder="name@company.com"
        />

        <FormTextField
          id="phoneNumber"
          name="phoneNumber"
          label="Phone Number"
          type="tel"
          icon={<PhoneIcon />}
          value={formData.phoneNumber}
          onChange={handleChange}
          placeholder="+91 98765 43210"
        />

        <FormSelectField
          id="userRole"
          name="role"
          label="Your Role"
          required
          icon={<UserRoleIcon />}
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
          icon={<TeamSizeIcon />}
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
          icon={<TargetIcon />}
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
          {!isSubmitting && <ArrowRightIcon />}
        </button>
      </div>

      <BookingTrustBadges />
    </form>
  );
}
