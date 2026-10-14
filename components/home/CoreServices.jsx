import React from 'react';
import { ShieldCheckIcon, RefreshProcessIcon, MessageIcon } from '@/components/icons/Icons';

export default function CoreServices() {
  return (
    <section className="sec-pad" style={{ background: 'var(--color-surface-alt)' }}>
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">Core Service Areas</span>
          <h2>
            Three Ways I Help You <span className="orange">Improve Sales</span>
          </h2>
        </div>

        <div className="grid-3">
          <div className="reveal d1">
            <div className="bonus-card">
              <span className="reveal-tag">Area 01</span>
              <span className="gift">
                <ShieldCheckIcon width="52" height="52" strokeWidth="1.5" />
              </span>
              <h5>Sales Strategy Development</h5>
              <div className="worth">Core Service</div>
              <p>Build a structured approach aligned with your business goals and target customers.</p>
            </div>
          </div>

          <div className="reveal d2">
            <div className="bonus-card">
              <span className="reveal-tag">Area 02</span>
              <span className="gift">
                <RefreshProcessIcon />
              </span>
              <h5>Sales Process Improvement</h5>
              <div className="worth">Core Service</div>
              <p>Identify gaps and create a repeatable approach to managing sales opportunities.</p>
            </div>
          </div>

          <div className="reveal d3">
            <div className="bonus-card">
              <span className="reveal-tag">Area 03</span>
              <span className="gift">
                <MessageIcon />
              </span>
              <h5>Sales Execution Support</h5>
              <div className="worth">Core Service</div>
              <p>Improve how your business handles conversations, follow-ups, and closing.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
