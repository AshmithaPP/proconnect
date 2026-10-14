'use client';

import { useState, useEffect } from 'react';

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

/**
 * Booking form state, slot availability, and the submit → payment handover flow.
 * @param {(data: object) => void} onSuccess - called with form data + booking once confirmed (mock mode)
 */
export default function useBookingForm(onSuccess) {
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

  return {
    formData,
    errorMessage,
    isSubmitting,
    unavailableSlots,
    handleChange,
    handleSlotChange,
    handleSubmit,
  };
}
