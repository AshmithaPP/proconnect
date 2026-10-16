/**
 * Sidebar sections per portal (client-safe). The admin portal contains everything the
 * consultant portal has (shared workspace pages) plus the platform pages.
 * `match: 'exact'` highlights only on that path; otherwise the link also covers sub-pages.
 */
export const PORTAL_NAVIGATION = {
  superadmin: [
    {
      sectionTitle: 'WORKSPACE',
      items: [
        { label: 'Dashboard', href: '/superadmin/dashboard', icon: 'dashboard', match: 'exact' },
        { label: 'Bookings', href: '/superadmin/dashboard/bookings', icon: 'calendar' },
        { label: 'Availability', href: '/superadmin/dashboard/availability', icon: 'clock' },
        { label: 'Schedule & Pricing', href: '/superadmin/dashboard/schedule', icon: 'tune' },
      ],
    },
    {
      sectionTitle: 'PLATFORM',
      items: [
        { label: 'Admin Account', href: '/superadmin/dashboard/consultant', icon: 'users' },
        { label: 'Settings', href: '/superadmin/dashboard/settings/general', activePrefix: '/superadmin/dashboard/settings', icon: 'settings' },
        { label: 'Email Templates', href: '/superadmin/dashboard/email-templates', icon: 'mail' },
      ],
    },
    {
      sectionTitle: 'ACCOUNT',
      items: [{ label: 'My Account', href: '/superadmin/dashboard/account', icon: 'user' }],
    },
  ],
  admin: [
    {
      sectionTitle: 'WORKSPACE',
      items: [
        { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard', match: 'exact' },
        { label: 'Bookings', href: '/admin/dashboard/bookings', icon: 'calendar' },
        { label: 'Availability', href: '/admin/dashboard/availability', icon: 'clock' },
        { label: 'Schedule & Pricing', href: '/admin/dashboard/schedule', icon: 'tune' },
        { label: 'Google Meet', href: '/admin/dashboard/google-meet', icon: 'video' },
      ],
    },
    {
      sectionTitle: 'ACCOUNT',
      items: [{ label: 'My Account', href: '/admin/dashboard/account', icon: 'user' }],
    },
  ],
};

/** @returns {boolean} */
export function isNavItemActive(item, pathname) {
  if (item.match === 'exact') return pathname === item.href;
  const prefix = item.activePrefix || item.href;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Label of the page currently open, for the header breadcrumb */
export function getActiveNavLabel(portalKey, pathname) {
  for (const section of PORTAL_NAVIGATION[portalKey] || []) {
    const item = section.items.find((navItem) => isNavItemActive(navItem, pathname));
    if (item) return item.label === 'Dashboard' ? 'Dashboard Overview' : item.label;
  }
  return 'Dashboard Overview';
}
