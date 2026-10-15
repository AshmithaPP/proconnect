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
  slotKey: '',
};

/**
 * Booking form state, the dynamic slot calendar (GET /api/bookings/availability), and the
 * submit → payment handover flow.
 * @param {(data: object) => void} onSuccess - called with form data + booking when payments are disabled (Worldline mode redirects instead)
 */
export default function useBookingForm(onSuccess) {
  const [formData, setFormData] = useState(initialForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availability, setAvailability] = useState({ days: [], fee: null, slotDurationMinutes: 30 });
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');

  const loadUnavailableSlots = async () => {
    try {
      const res = await fetch('/api/bookings/availability', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.days)) {
        setAvailability({ days: data.days, fee: data.fee, slotDurationMinutes: data.slotDurationMinutes });
        // Keep the chosen date if it is still in the window, else the first day with free slots
        setSelectedDate((current) =>
          data.days.some((d) => d.date === current)
            ? current
            : (data.days.find((d) => d.availableCount > 0) || data.days[0])?.date || ''
        );
        // Drop a selected slot that is no longer available
        setFormData((prev) => {
          const stillFree = data.days.some((d) => d.slots.some((s) => s.slotKey === prev.slotKey && s.status === 'available'));
          return stillFree ? prev : { ...prev, slotKey: '' };
        });
      }
    } catch {
      // keep the last known calendar
    } finally {
      setIsLoadingSlots(false);
    }
  };

  useEffect(() => {
    loadUnavailableSlots();

    // Re-sync whenever the customer comes back to this page — e.g. after cancelling on the
    // payment page — so the picker always reflects the backend (only paid slots are taken).
    const handlePageShow = (event) => {
      if (event.persisted) {
        // Restored from the browser back/forward cache: clear the stale "submitting" state
        setIsSubmitting(false);
      }
      loadUnavailableSlots();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadUnavailableSlots();
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSlotChange = (slotKey) => {
    setFormData((prev) => ({
      ...prev,
      slotKey,
    }));
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setFormData((prev) => {
      if (prev.slotKey && !prev.slotKey.startsWith(date)) {
        return { ...prev, slotKey: '' };
      }
      return prev;
    });
  };

  const selectedSlotLabel = (() => {
    for (const day of availability.days) {
      const slot = day.slots.find((s) => s.slotKey === formData.slotKey);
      if (slot) return `${day.dateLabel}, ${slot.label}`;
    }
    return '';
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { fullName, companyName, workEmail, phoneNumber, role, challenge, slotKey } = formData;

    if (!fullName.trim() || !companyName.trim() || !workEmail.trim() || !phoneNumber.trim() || !role || !challenge || !slotKey) {
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
          setFormData((prev) => ({ ...prev, slotKey: '' }));
        }
        return;
      }

      const { booking } = bookingData;

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

          // Slot was paid for by someone else meanwhile: refresh availability and reset field
          if (checkoutRes.status === 409) {
            loadUnavailableSlots();
            setFormData((prev) => ({ ...prev, slotKey: '' }));
          }
          return;
        }

        // Direct customer browser to Worldline's secure Hosted Checkout page
        window.location.href = checkoutData.redirectUrl;
        return;
      }

      // 3. Payments disabled (PAYMENT_MODE=disabled): request stored, show confirmation of receipt
      setIsSubmitting(false);
      onSuccess({ ...formData, timeSlot: selectedSlotLabel, booking });
    } catch {
      setErrorMessage('Network connection error. Please try again.');
      setIsSubmitting(false);
    }
  };

  return {
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
  };
}
