import React from 'react';
import { B2BIcon, StoreIcon, UsersIcon, BriefcaseIcon } from '@/components/ui/Icons';

export default function LogoStrip() {
  return (
    <div className="logo-strip reveal d4">
      <div className="logo-chip">
        <span className="ic">
          <B2BIcon />
        </span>
        B2B Sales
      </div>

      <div className="logo-chip">
        <span className="ic">
          <StoreIcon />
        </span>
        SMB Owners
      </div>

      <div className="logo-chip">
        <span className="ic">
          <UsersIcon />
        </span>
        Sales Teams
      </div>

      <div className="logo-chip">
        <span className="ic">
          <BriefcaseIcon />
        </span>
        Professionals
      </div>
    </div>
  );
}
