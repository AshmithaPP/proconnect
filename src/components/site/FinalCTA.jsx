import React from 'react';
import { ArrowRightIcon } from '@/components/ui/Icons';

export default function FinalCTA() {
  return (
    <section className="sec-pad">
      <div className="container">
        <div className="final-cta reveal" id="cta-banner">
          <div style={{ position: 'relative', zIndex: 2 }}>
            <span className="eyebrow">Ready When You Are</span>
            <h2>Ready to Strengthen Your Company&apos;s Sales?</h2>
            <p className="mx-auto" style={{ maxWidth: '540px' }}>
              Let&apos;s understand your sales challenges and explore a strategy that aligns with your business goals.
            </p>
            <a
              href="#book"
              className="btn-pro btn-orange mt-3"
              style={{ fontSize: '1.02rem', padding: '18px 40px' }}
            >
              Book a Business Sales Consultation <ArrowRightIcon />
            </a>
            <p className="mt-3 mb-0" style={{ fontSize: '0.75rem', color: '#8a857c' }}>
              1-to-1 Consultation · 100% Confidential · Clear Next Steps
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
