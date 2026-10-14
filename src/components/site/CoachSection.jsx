'use client';

import React, { useState } from 'react';
import { ArrowRightIcon } from '@/components/ui/Icons';

export default function CoachSection() {
  const [imgError, setImgError] = useState(false);

  return (
    <section className="sec-pad" id="coach">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">About</span>
          <h2>
            Meet Your <span className="orange">Sales Consultant</span>
          </h2>
        </div>

        <div className="coach-premium reveal d1">
          {/* Left: Visual */}
          <div className="coach-visual">
            <div className="coach-photo-frame">
              {!imgError ? (
                <img
                  src="/assets/img/cynthia.jpg"
                  alt="Sales Consultant"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="placeholder">SC</div>
              )}
              <div className="coach-badge-float">
                <div className="num">10+</div>
                <div className="txt">Years Experience</div>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="coach-content">
            <span className="pre-title">Sales Strategy Consultant</span>
            <h3>
              Sales Expertise That <span>Understands Business.</span>
            </h3>
            <p className="desc">
              With over a decade of hands-on sales experience, I help businesses identify hidden gaps,
              restructure their sales approach, and build a repeatable process that converts.
              My work is grounded in real conversations — not theory — and tailored to your specific
              business model and growth stage.
            </p>
            <p className="desc" style={{ marginTop: '12px' }}>
              Whether you&apos;re an individual sales professional or a founder building a revenue engine,
              the focus stays on practical, outcome-driven guidance that you can implement immediately.
            </p>
            <div className="coach-stats-row">
              <div className="coach-stat-pill">
                <span className="n">10+</span>
                <span className="l">Years</span>
              </div>
              <div className="coach-stat-pill">
                <span className="n">B2B</span>
                <span className="l">Focus</span>
              </div>
              <div className="coach-stat-pill">
                <span className="n">SMB</span>
                <span className="l">Owners</span>
              </div>
              <div className="coach-stat-pill">
                <span className="n">1-to-1</span>
                <span className="l">Sessions</span>
              </div>
            </div>
            <div className="coach-cta">
              <a href="#book" className="btn-pro btn-orange" style={{ padding: '14px 28px', fontSize: '0.88rem' }}>
                Book a Consultation <ArrowRightIcon />
              </a>
              <span style={{ fontSize: '0.75rem', color: '#7d786e' }}>
                1-to-1 · Confidential · Actionable
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
