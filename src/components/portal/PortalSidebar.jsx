'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/features/auth/components/LogoutButton';
import { DashboardGridIcon, CalendarIcon, ClockIcon, TrendingUpIcon, UsersIcon, ServerIcon, MailIcon, UserIcon } from '@/components/ui/Icons';
import { FiVideo } from 'react-icons/fi';
import { getPortal } from '@/features/auth/portals';
import { PORTAL_NAVIGATION, isNavItemActive } from '@/features/auth/portal-navigation';

const NAV_ICONS = {
  dashboard: DashboardGridIcon,
  calendar: CalendarIcon,
  clock: ClockIcon,
  tune: TrendingUpIcon,
  users: UsersIcon,
  settings: ServerIcon,
  mail: MailIcon,
  user: UserIcon,
  video: FiVideo,
};

/**
 * @param {{ portalKey: 'admin' | 'consultant', user: { fullName: string, email: string } }} props
 */
export default function PortalSidebar({ portalKey, user }) {
  const pathname = usePathname();
  const portal = getPortal(portalKey);

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : portal.label.slice(0, 2).toUpperCase();

  return (
    <aside className="admin-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-box">
        <Link href={portal.homePath} className="sidebar-brand-link">
          <div className="brand-dot" />
          <span className="brand-text">
            ProConnect <span className="brand-badge-pill">{portal.label}</span>
          </span>
        </Link>
      </div>

      {/* Main Navigation */}
      <div className="sidebar-content-scroll">
        {PORTAL_NAVIGATION[portalKey].map((section) => (
          <div key={section.sectionTitle} className="sidebar-section-group">
            <span className="sidebar-section-title">{section.sectionTitle}</span>
            <ul className="sidebar-nav-list">
              {section.items.map((item) => {
                const Icon = NAV_ICONS[item.icon] || DashboardGridIcon;
                return (
                  <li key={item.href} className="sidebar-nav-item">
                    <Link
                      href={item.href}
                      className={`sidebar-nav-link ${isNavItemActive(item, pathname) ? 'active' : ''}`}
                    >
                      <span className="link-icon-wrap">
                        <Icon className="sidebar-icon" />
                      </span>
                      <span className="link-label">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Account Profile Card & Sign Out Footer */}
      <div className="sidebar-footer-profile">
        <div className="sidebar-user-row">
          <div className="user-avatar-circle">{initials}</div>
          <div className="user-info-text">
            <span className="user-name-title" title={user?.fullName}>
              {user?.fullName || portal.label}
            </span>
            <span className="user-email-text" title={user?.email}>
              {user?.email}
            </span>
          </div>
        </div>
        <div className="sidebar-logout-box">
          <LogoutButton portalKey={portalKey} />
        </div>
      </div>
    </aside>
  );
}
