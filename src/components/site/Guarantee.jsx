import React from 'react';
import { ShieldCheckIcon, ArrowRightIcon } from '@/components/ui/Icons';

export default function Guarantee() {
  return (
    <section className="sec-pad">
      <div className="container">
        <div className="guarantee reveal">
          <span className="badge-icon">
            <ShieldCheckIcon width="56" height="56" strokeWidth="1.6" />
          </span>
          <h2>Still Not Sure? I&apos;ve Got Your Back.</h2>
          <p>
            Book the consultation, go through the session, and if you don&apos;t find it valuable for any reason, simply
            reach out and we&apos;ll make it right — no questions asked. The focus is always on giving you clarity and a
            clear way forward.
          </p>
          <a href="#book" className="btn-pro btn-dark">
            Book a Business Sales Consultation <ArrowRightIcon />
          </a>
        </div>
      </div>
    </section>
  );
}
