'use client';

import React, { useState, useEffect } from 'react';
import TimeSlotPicker from './TimeSlotPicker';
import {
  UserIcon,
  BuildingIcon,
  MailIcon,
  PhoneIcon,
  UserRoleIcon,
  TeamSizeIcon,
  TargetIcon,
  ChevronDownIcon,
  ArrowRightIcon,
  LockIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@/components/ui/Icons';
import {
  USER_ROLE_OPTIONS,
  SALES_TEAM_SIZE_OPTIONS,
  SALES_CHALLENGE_OPTIONS,
} from '@/features/booking/booking.options';

const initialForm = {
  fullName: '',
  companyName: '',
  workEmail: '',
  phoneNumber: '',
  role: '',
  roleOther: '',
  teamSize: '',
  challenge: '',
  challengeOther: '',
  timeSlot: '',
};

export default function BookingForm({ onSuccess }) {
  const [formData, setFormData] = useState(initialForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unavailableSlots, setUnavailableSlots] = useState([]);

  const loadUnavailableSlots = async () => {
    try {
      const res = await fetch('/api/bookings/slots');
      const data = await res.json();
      if (data.success && Array.isArray(data.unavailableSlots)) {
        setUnavailableSlots(data.unavailableSlots);
      }
    } catch {
      // fallback silently
    }
  };

  useEffect(() => {
    loadUnavailableSlots();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSlotChange = (slot) => {
    setFormData((prev) => ({
      ...prev,
      timeSlot: slot,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { fullName, companyName, workEmail, phoneNumber, role, challenge, timeSlot } = formData;

    if (!fullName.trim() || !companyName.trim() || !workEmail.trim() || !phoneNumber.trim() || !role || !challenge || !timeSlot) {
      setErrorMessage('Please fill in all required fields (*).');
      return;
    }

    // Email format validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(workEmail.trim())) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      // 1. Create the booking (stored as pending_payment)
      const bookingRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const bookingData = await bookingRes.json();

      if (!bookingRes.ok) {
        setErrorMessage(bookingData.error || 'Could not submit your request. Please try again.');
        setIsSubmitting(false);

        // If slot conflict occurs, refresh unavailable slots and reset field
        if (bookingRes.status === 409) {
          loadUnavailableSlots();
          setFormData((prev) => ({ ...prev, timeSlot: '' }));
        }
        return;
      }

      let { booking } = bookingData;

      // 2. Worldline Payment Gateway Handover
      if (bookingData.paymentMode === 'worldline') {
        const checkoutRes = await fetch('/api/payments/worldline/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: booking.bookingId }),
        });
        const checkoutData = await checkoutRes.json();

        if (!checkoutRes.ok || !checkoutData.redirectUrl) {
          setErrorMessage(checkoutData.error || 'Could not initialize Worldline payment. Please try again.');
          setIsSubmitting(false);
          return;
        }

        // Direct customer browser to Worldline's secure Hosted Checkout page
        window.location.href = checkoutData.redirectUrl;
        return;
      }

      // 3. Fallback: Internal instant mock confirmation
      if (bookingData.paymentMode === 'mock') {
        const paymentRes = await fetch(`/api/bookings/${booking.bookingId}/mock-payment`, {
          method: 'POST',
        });
        const paymentData = await paymentRes.json();

        if (!paymentRes.ok) {
          setErrorMessage(paymentData.error || 'Payment could not be completed. Please try again.');
          setIsSubmitting(false);
          return;
        }

        booking = {
          ...booking,
          bookingStatus: paymentData.booking.bookingStatus,
          payment: { ...booking.payment, ...paymentData.booking.payment },
        };
      }

      setIsSubmitting(false);
      onSuccess({ ...formData, booking });
    } catch {
      setErrorMessage('Network connection error. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="field-label">
            Full Name <span className="req">*</span>
          </label>
          <div className="input-wrap">
            <span className="field-icon">
              <UserIcon />
            </span>
            <input
              type="text"
              className="form-control-pro"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="e.g. Cynthia Vance"
              required
            />
          </div>
        </div>

        {/* Company Name */}
        <div>
          <label htmlFor="companyName" className="field-label">
            Company Name <span className="req">*</span>
          </label>
          <div className="input-wrap">
            <span className="field-icon">
              <BuildingIcon />
            </span>
            <input
              type="text"
              className="form-control-pro"
              id="companyName"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              placeholder="e.g. Acme Corp"
              required
            />
          </div>
        </div>

        {/* Work Email */}
        <div>
          <label htmlFor="workEmail" className="field-label">
            Work Email <span className="req">*</span>
          </label>
          <div className="input-wrap">
            <span className="field-icon">
              <MailIcon />
            </span>
            <input
              type="email"
              className="form-control-pro"
              id="workEmail"
              name="workEmail"
              value={formData.workEmail}
              onChange={handleChange}
              placeholder="name@company.com"
              required
            />
          </div>
        </div>

        {/* Phone Number */}
        <div>
          <label htmlFor="phoneNumber" className="field-label">
            Phone Number <span className="req">*</span>
          </label>
          <div className="input-wrap">
            <span className="field-icon">
              <PhoneIcon />
            </span>
            <input
              type="tel"
              className="form-control-pro"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              required
            />
          </div>
        </div>

        {/* Your Role */}
        <div>
          <label htmlFor="userRole" className="field-label">
            Your Role <span className="req">*</span>
          </label>
          <div className="select-wrap">
            <span className="field-icon">
              <UserRoleIcon />
            </span>
            <select
              id="userRole"
              name="role"
              className="form-select-pro"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select
              </option>
              {USER_ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="select-arrow">
              <ChevronDownIcon />
            </span>
          </div>
          {formData.role === 'Other' && (
            <div className="other-field-wrap">
              <input
                type="text"
                className="form-control-pro no-icon"
                id="roleOtherInput"
                name="roleOther"
                value={formData.roleOther}
                onChange={handleChange}
                placeholder="Specify your role"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Current Sales Team Size */}
        <div>
          <label htmlFor="teamSize" className="field-label">
            Current Sales Team Size
          </label>
          <div className="select-wrap">
            <span className="field-icon">
              <TeamSizeIcon />
            </span>
            <select
              id="teamSize"
              name="teamSize"
              className="form-select-pro"
              value={formData.teamSize}
              onChange={handleChange}
            >
              <option value="" disabled>
                Select
              </option>
              {SALES_TEAM_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="select-arrow">
              <ChevronDownIcon />
            </span>
          </div>
        </div>

        {/* Biggest Sales Challenge */}
        <div className="col-full">
          <label htmlFor="salesChallenge" className="field-label">
            What Is Your Biggest Sales Challenge? <span className="req">*</span>
          </label>
          <div className="select-wrap">
            <span className="field-icon">
              <TargetIcon />
            </span>
            <select
              id="salesChallenge"
              name="challenge"
              className="form-select-pro"
              value={formData.challenge}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select
              </option>
              {SALES_CHALLENGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="select-arrow">
              <ChevronDownIcon />
            </span>
          </div>
          {formData.challenge === 'Other' && (
            <div className="other-field-wrap">
              <input
                type="text"
                className="form-control-pro no-icon"
                id="challengeOtherInput"
                name="challengeOther"
                value={formData.challengeOther}
                onChange={handleChange}
                placeholder="Describe your sales challenge"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Preferred Time Slot */}
        <div className="col-full">
          <label className="field-label">
            Preferred Time Slot <span className="req">*</span>
          </label>
          <TimeSlotPicker
            value={formData.timeSlot}
            onChange={handleSlotChange}
            unavailableSlots={unavailableSlots}
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
          style={{
            fontSize: '1rem',
            padding: '15px 28px',
            opacity: isSubmitting ? 0.75 : 1,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          <span>{isSubmitting ? 'Connecting to Secure Worldline Checkout...' : 'Proceed to Worldline Payment (₹999)'}</span>
          {!isSubmitting && <ArrowRightIcon />}
        </button>
      </div>

      {/* Trust Badges */}
      <div className="trust-badges-bar">
        <div className="trust-badge-item">
          <span className="ic">
            <LockIcon />
          </span>
          100% Confidential
        </div>
        <div className="trust-badge-item">
          <span className="ic">
            <ClockIcon />
          </span>
          24-Hour Response
        </div>
        <div className="trust-badge-item">
          <span className="ic">
            <CheckCircleIcon />
          </span>
          Clear Next Steps
        </div>
      </div>
    </form>
  );
}
