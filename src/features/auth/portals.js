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
  admin: {
    portalKey: 'admin',
    userRole: 'platform_admin',
    label: 'Admin',
    audience: 'administrator',
    cookieBaseName: 'admin_session',
    basePath: '/admin',
    loginPath: '/admin/login',
    homePath: '/admin/dashboard',
  },
  consultant: {
    portalKey: 'consultant',
    userRole: 'consultant',
    label: 'Consultant',
    audience: 'consultant',
    cookieBaseName: 'consultant_session',
    basePath: '/consultant',
    loginPath: '/consultant/login',
    homePath: '/consultant/dashboard',
  },
};

/**
 * @param {string} portalKey
 * @returns {typeof PORTALS.admin | null}
 */
export function getPortal(portalKey) {
  return Object.hasOwn(PORTALS, portalKey) ? PORTALS[portalKey] : null;
}
