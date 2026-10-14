'use client';

import React, { useEffect, useRef, useState } from 'react';

const statsData = [
  { target: 10, suffix: '+', label: 'Years in Sales', initial: '0+' },
  { target: 500, suffix: '+', label: 'Sales Conversations', initial: '0+' },
  { target: 3, suffix: '', label: 'Core Service Areas', initial: '0' },
  { target: 1, suffix: '-to-1', label: 'Personalized Focus', initial: '0-to-1' },
  { target: 100, suffix: '%', label: 'Business Focus', initial: '0%' },
  { target: 50, suffix: '+', label: 'SMB Owners Served', initial: '0+' },
];

export default function PortfolioStats() {
  const sectionRef = useRef(null);
  const [counts, setCounts] = useState(statsData.map((s) => s.initial));
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            animate();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(el);

    function animate() {
      const duration = 2000;
      const startTime = performance.now();

      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        const newCounts = statsData.map(({ target, suffix }) => {
          const current = target * eased;
          if (suffix === '-to-1') {
            return `${Math.round(current)}-to-1`;
          }
          return `${Math.round(current)}${suffix}`;
        });

        setCounts(newCounts);

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          setCounts(
            statsData.map(({ target, suffix }) => {
              if (suffix === '-to-1') return `${target}-to-1`;
              return `${target}${suffix}`;
            })
          );
        }
      }

      requestAnimationFrame(update);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section className="sec-pad" style={{ background: 'var(--color-surface-alt)' }}>
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">Portfolio</span>
          <h2>
            Numbers That <span className="orange">Speak for Themselves</span>
          </h2>
        </div>

        <div className="portfolio-grid reveal d1" ref={sectionRef} id="portfolioStats">
          {statsData.map((stat, idx) => (
            <div className="p-stat" key={idx}>
              <div className="num">{counts[idx]}</div>
              <div className="lbl">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
