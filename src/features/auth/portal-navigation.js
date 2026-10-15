/**
 * Sidebar sections per portal (client-safe). The admin portal contains everything the
 * consultant portal has (shared workspace pages) plus the platform pages.
 * `match: 'exact'` highlights only on that path; otherwise the link also covers sub-pages.
 */
export const PORTAL_NAVIGATION = {
  admin: [
    {
      sectionTitle: 'WORKSPACE',
      items: [
        { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard', match: 'exact' },
        { label: 'Bookings', href: '/admin/dashboard/bookings', icon: 'calendar' },
        { label: 'Availability', href: '/admin/dashboard/availability', icon: 'clock' },
        { label: 'Schedule & Pricing', href: '/admin/dashboard/schedule', icon: 'tune' },
      ],
    },
    {
      sectionTitle: 'PLATFORM',
      items: [
        { label: 'Consultants', href: '/admin/dashboard/consultants', icon: 'users' },
        { label: 'Settings', href: '/admin/dashboard/settings/general', activePrefix: '/admin/dashboard/settings', icon: 'settings' },
        { label: 'Email Templates', href: '/admin/dashboard/email-templates', icon: 'mail' },
      ],
    },
    {
      sectionTitle: 'ACCOUNT',
      items: [{ label: 'My Account', href: '/admin/dashboard/account', icon: 'user' }],
    },
  ],
  consultant: [
    {
      sectionTitle: 'WORKSPACE',
      items: [
        { label: 'Dashboard', href: '/consultant/dashboard', icon: 'dashboard', match: 'exact' },
        { label: 'Bookings', href: '/consultant/dashboard/bookings', icon: 'calendar' },
        { label: 'Availability', href: '/consultant/dashboard/availability', icon: 'clock' },
        { label: 'Schedule & Pricing', href: '/consultant/dashboard/schedule', icon: 'tune' },
      ],
    },
    {
      sectionTitle: 'ACCOUNT',
      items: [{ label: 'My Account', href: '/consultant/dashboard/account', icon: 'user' }],
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
