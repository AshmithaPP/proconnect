import React from 'react';

export default function WhyWorkWithMe() {
  return (
    <section className="sec-pad">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">Why Work With Me</span>
          <h2>
            Sales Expertise That <span className="orange">Understands Business.</span>
          </h2>
        </div>

        <div className="grid-2">
          <div className="reveal d1">
            <div className="why-card">
              <div className="num">01</div>
              <h5>10+ Years Experience</h5>
              <p>Practical guidance shaped by over a decade of real sales conversations and business outcomes.</p>
            </div>
          </div>

          <div className="reveal d2">
            <div className="why-card">
              <div className="num">02</div>
              <h5>Business-First Approach</h5>
              <p>Every recommendation is aligned to your business model, goals, and target customers.</p>
            </div>
          </div>

          <div className="reveal d3">
            <div className="why-card">
              <div className="num">03</div>
              <h5>100% Practical</h5>
              <p>No fluff, no theory. Actionable steps you can implement right after the consultation.</p>
            </div>
          </div>

          <div className="reveal d4">
            <div className="why-card">
              <div className="num">04</div>
              <h5>Clear Next Steps</h5>
              <p>Walk away with direction, confidence, and focus for your next sales move.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
