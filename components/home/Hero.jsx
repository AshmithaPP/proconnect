import React from 'react';
import PhotoRing from '@/components/home/PhotoRing';
import InfoGrid from '@/components/home/InfoGrid';
import LogoStrip from '@/components/home/LogoStrip';
import { ArrowRightIcon, ArrowDownIcon } from '@/components/icons/Icons';

export default function Hero() {
  return (
    <header className="hero" id="top">
      <div className="container">
        <div className="hero-grid">
          <div>
            <PhotoRing />
          </div>

          <div>
            <span className="hero-attention reveal">Attention: Business Owners &amp; Sales Leaders</span>
            <h1 className="reveal d1">
              Build a Sales Process That <span className="orange">Drives Business Growth.</span>
            </h1>
            <p className="lead-p reveal d2">
              Helping companies strengthen their sales strategy, improve lead conversion, and build a more structured sales process with{' '}
              <strong>10+ years of sales experience</strong>.
            </p>
            <div className="price-row reveal d3">
              <span className="price-now">Book a Consultation</span>
              <span className="price-old">₹4,999</span>
            </div>
            <div className="d-flex flex-wrap gap-3 mt-4 reveal d4">
              <a href="#book" className="btn-pro btn-orange">
                Book a Business Sales Consultation <ArrowRightIcon />
              </a>
              <a href="#learn" className="btn-pro btn-dark">
                See What You Get <ArrowDownIcon />
              </a>
            </div>
          </div>
        </div>

        <InfoGrid />
        <LogoStrip />
      </div>
    </header>
  );
}
