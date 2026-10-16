'use client';

import React, { useState } from 'react';
import { ShieldCheckIcon, B2BIcon, StoreIcon, UsersIcon } from '@/components/ui/Icons';

export default function PhotoRing() {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="hero-photo-wrap reveal d2">
      <div className="hero-photo-ring">
        {!imgError ? (
          <img
            src="/assets/img/cynthia.jpeg"
            alt="Sales Strategy Consultant"
            className="hero-photo"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="hero-photo-placeholder">SC</div>
        )}
      </div>

      <div className="photo-badge pb-1">
        <span className="ic">
          <ShieldCheckIcon strokeWidth="2.2" />
        </span>
        <div>
          10+ Years
          <small>Sales Experience</small>
        </div>
      </div>

      <div className="photo-badge pb-2">
        <span className="ic">
          <B2BIcon />
        </span>
        <div>
          B2B Sales
          <small>Business Focus</small>
        </div>
      </div>

      <div className="photo-badge pb-3">
        <span className="ic">
          <StoreIcon />
        </span>
        <div>
          SMB Owners
          <small>Growth Focused</small>
        </div>
      </div>

      <div className="photo-badge pb-4">
        <span className="ic">
          <UsersIcon />
        </span>
        <div>
          Sales Teams
          <small>Process &amp; Execution</small>
        </div>
      </div>

      <div className="coach-name-tag">
        <div className="name">Sales Strategy Consultant</div>
        <div className="role">10+ Years Sales Experience</div>
      </div>
    </div>
  );
}
