'use client';

import React, { useState, useEffect } from 'react';
import BookingForm from './BookingForm';
import SubmissionSuccess from './SubmissionSuccess';
import { ClockIcon, CheckCircleIcon, LockIcon } from '@/components/ui/Icons';

export default function ConsultationBooking() {
  const [submittedData, setSubmittedData] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const isGoogleAuth = url.searchParams.get('google_auth') === 'success';
      const hasBookingHash = url.hash === '#book' || url.hash === '#booking-section' || url.hash === '#consultation-form';
      if (isGoogleAuth || hasBookingHash) {
        const timer = setTimeout(() => {
          const formWrap = document.getElementById('consultation-form-wrap') || document.getElementById('book');
          if (formWrap) {
            formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 120);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleSuccess = (data) => {
    setSubmittedData(data);
    const formElement = document.getElementById('consultation-form-wrap');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleReset = () => {
    setSubmittedData(null);
    const formElement = document.getElementById('consultation-form-wrap');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="sec-pad" id="book" style={{ background: 'var(--color-surface-alt)' }}>
      <div id="booking-section" style={{ position: 'relative', top: '-60px' }} />
      <div id="consultation-form" style={{ position: 'relative', top: '-30px' }} />
      <div className="container">
        <div className="consultation-split">
          {/* Left Column: Information & Perks */}
          <div className="reveal d1">
            <div className="consultation-left-wrap">
              <span className="hero-attention" style={{ fontSize: '0.74rem' }}>
                Business Sales Consultation Form
              </span>
              <h2 className="consultation-left-title">
                Let&apos;s Discuss Your <span className="orange">Business Sales Goals</span>
              </h2>
              <p className="consultation-left-sub">
                Share a few details about your business and sales challenges. We&apos;ll get in touch to discuss how we can help.
              </p>

              <div className="consultation-perks">
                <div className="perk-item">
                  <div className="perk-icon">
                    <ClockIcon />
                  </div>
                  <div>
                    <h6>30-Minute 1-on-1 Consultation</h6>
                    <p>Direct focused session to analyze your current sales structure and pipeline.</p>
                  </div>
                </div>

                <div className="perk-item">
                  <div className="perk-icon">
                    <CheckCircleIcon />
                  </div>
                  <div>
                    <h6>Actionable &amp; Practical Advice</h6>
                    <p>Walk away with concrete recommendations you can execute right away.</p>
                  </div>
                </div>

                <div className="perk-item">
                  <div className="perk-icon">
                    <LockIcon />
                  </div>
                  <div>
                    <h6>100% Confidential</h6>
                    <p>All business metrics and challenge details remain strictly confidential.</p>
                  </div>
                </div>
              </div>

              <div className="consultation-guarantee-chip mt-4">
                <span className="dot" /> 1-to-1 Session · Confidential · Clear Next Steps
              </div>
            </div>
          </div>

          {/* Right Column: Form / Success Card */}
          <div className="reveal d2" id="consultation-form-wrap">
            <div className="consultation-card">
              {submittedData ? (
                <SubmissionSuccess data={submittedData} onReset={handleReset} />
              ) : (
                <BookingForm onSuccess={handleSuccess} />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
