import React from 'react';

export default function OutcomesTimeline() {
  return (
    <section className="sec-pad" id="learn" style={{ background: 'var(--color-surface-alt)' }}>
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">What You Will Gain</span>
          <h2>
            Turn Your Sales Challenges Into <span className="orange">Growth Opportunities.</span>
          </h2>
          <p>Four focused outcomes you can expect from a structured sales consultation.</p>
        </div>

        <div className="timeline-wrap">
          <div className="timeline">
            <div className="tl-item reveal d1">
              <span className="tl-time">Outcome 01</span>
              <h5>Improve Lead Conversion</h5>
              <p>Identify gaps in your sales process that may be costing you potential customers.</p>
            </div>

            <div className="tl-item reveal d2">
              <span className="tl-time">Outcome 02</span>
              <h5>Build a Clear Sales Strategy</h5>
              <p>Create a structured approach aligned with your business goals and target customers.</p>
            </div>

            <div className="tl-item reveal d3">
              <span className="tl-time">Outcome 03</span>
              <h5>Strengthen Sales Execution</h5>
              <p>Improve how your business handles sales conversations, follow-ups, and closing.</p>
            </div>

            <div className="tl-item reveal d4">
              <span className="tl-time">Outcome 04</span>
              <h5>Create a More Consistent Sales Process</h5>
              <p>Reduce guesswork and establish a repeatable approach to managing sales opportunities.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
