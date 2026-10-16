/**
 * The two signed-in areas of the site. Client-safe (no secrets): used by the middleware,
 * login form, server guards and API routes so paths, roles and cookies never drift apart.
 *
 *  - admin      → our company (platform_admin): SMTP, general settings, SEO, consultant accounts
 *  - consultant → the client (consultant): bookings, availability, analytics
 *
 * Each portal has its own session cookie, so signing in to one never signs you in to (or out
 * of) the other, and a session is only ever accepted for its own role.
 */
export const PORTALS = {
  superadmin: {
    portalKey: 'superadmin',
    userRole: 'platform_admin',
    label: 'Super Admin',
    audience: 'super administrator',
    cookieBaseName: 'superadmin_session',
    basePath: '/superadmin',
    loginPath: '/superadmin/login',
    homePath: '/superadmin/dashboard',
  },
  admin: {
    portalKey: 'admin',
    userRole: 'consultant',
    label: 'Admin',
    audience: 'administrator',
    cookieBaseName: 'admin_session',
    basePath: '/admin',
    loginPath: '/admin/login',
    homePath: '/admin/dashboard',
  },
};

/**
 * @param {string} portalKey
 * @returns {typeof PORTALS.superadmin | null}
 */
export function getPortal(portalKey) {
  if (portalKey === 'consultant') return PORTALS.admin;
  return Object.hasOwn(PORTALS, portalKey) ? PORTALS[portalKey] : null;
}
