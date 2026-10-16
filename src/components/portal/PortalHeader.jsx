'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiExternalLink } from 'react-icons/fi';
import LogoutButton from '@/features/auth/components/LogoutButton';
import { getPortal } from '@/features/auth/portals';
import { getActiveNavLabel } from '@/features/auth/portal-navigation';

/**
 * @param {{ portalKey: 'admin' | 'consultant' }} props
 */
export default function PortalHeader({ portalKey }) {
  const pathname = usePathname();

  return (
    <header className="admin-top-header">
      <div className="header-breadcrumbs">
        <span className="crumb-root">{getPortal(portalKey).label} Portal</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-active">{getActiveNavLabel(portalKey, pathname)}</span>
      </div>

      <div className="header-actions-row">
        {/* Public Website Link */}
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="header-public-link"
        >
          <FiExternalLink className="icon-inline" style={{ marginRight: '6px' }} /> Public Website
        </Link>

        {/* Top Header Sign Out */}
        <LogoutButton portalKey={portalKey} />
      </div>
    </header>
  );
}
