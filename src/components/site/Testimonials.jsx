import React from 'react';

const testimonials = [
  {
    quote:
      '“My conversion rate was stuck for months. One call helped me see exactly where my follow-ups were failing. The recommendations were practical and easy to apply.”',
    name: 'Ramesh K.',
    role: 'Business Owner, Chennai',
    avatar: 'RK',
    avatarBg: 'var(--color-primary)',
    result: '2× follow-up response rate',
    delay: 'd1',
  },
  {
    quote:
      '“I kept losing deals on price. The strategies to handle objections changed how I run my sales conversations completely. Worth every rupee.”',
    name: 'Priya S.',
    role: 'Sales Professional, Bengaluru',
    avatar: 'PS',
    avatarBg: '#2b2b2b',
    result: 'Closed 3 deals in 30 days',
    delay: 'd2',
  },
  {
    quote:
      '“As a founder, every big deal depended on me. The call gave me a clear process to reduce that dependency and coach my team properly.”',
    name: 'Arun M.',
    role: 'Founder, SaaS Startup',
    avatar: 'AM',
    avatarBg: '#3d6b2a',
    result: 'Reduced founder dependency',
    delay: 'd3',
  },
];

export default function Testimonials() {
  return (
    <section className="sec-pad">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">Client Feedback</span>
          <h2>
            Trusted by Businesses. <span className="orange">Focused on Sales Improvement.</span>
          </h2>
        </div>

        <div className="grid-3">
          {testimonials.map((t, idx) => (
            <div className={`reveal ${t.delay}`} key={idx}>
              <div className="testi-card">
                <div>
                  <div className="stars">★★★★★</div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>{t.quote}</p>
                </div>
                <div>
                  <div className="testi-who">
                    <div className="avatar" style={{ background: t.avatarBg }}>
                      {t.avatar}
                    </div>
                    <div>
                      <h6 className="mb-0" style={{ fontSize: '0.92rem', fontWeight: 800 }}>
                        {t.name}
                      </h6>
                      <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                        {t.role}
                      </span>
                    </div>
                  </div>
                  <span className="result-tag">{t.result}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p
          className="text-center mt-4 reveal"
          style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}
        >
          Testimonials shown with client permission. Names abbreviated for privacy.
        </p>
      </div>
    </section>
  );
}
