'use client';

import React from 'react';
import Link from 'next/link';
import LogoutButton from './LogoutButton';

export default function AdminHeader() {
  return (
    <header className="admin-top-header">
      <div className="header-breadcrumbs">
        <span className="crumb-root">Portal</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-active">Dashboard Overview</span>
      </div>

      <div className="header-actions-row">
        {/* Database Connected Pill */}
        <div className="header-status-pill">
          <span className="live-pulse-dot" />
          <span>MySQL 8 Active</span>
        </div>

        {/* Public Website Link */}
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="header-public-link"
        >
          ↗ Public Website
        </Link>

        {/* Top Header Sign Out */}
        <LogoutButton />
      </div>
    </header>
  );
}
