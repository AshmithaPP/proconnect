'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'General', href: '/admin/dashboard/settings/general' },
  { label: 'SEO', href: '/admin/dashboard/settings/seo' },
  { label: 'SMTP', href: '/admin/dashboard/settings/smtp' },
];

export default function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="portal-tabs" aria-label="Settings sections">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={`portal-tab${pathname === tab.href ? ' active' : ''}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
