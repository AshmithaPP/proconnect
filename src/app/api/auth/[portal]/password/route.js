import { getPortal } from '@/features/auth/portals';
import { verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import { checkPassword } from '@/features/auth/account.schema';
import { hashPassword, verifyPassword } from '@/features/auth/password';
import { findPortalUserById, setPortalUserPassword, revokeAllSessionsForUser } from '@/features/auth/portal-user.repository';

/**
 * PUT /api/auth/{admin|consultant}/password — change your own password
 * Body: { currentPassword, newPassword }
 * Signs you out on every other device; this session stays signed in.
 */
export async function PUT(request, { params }) {
  const { portal: portalKey } = await params;
  if (!getPortal(portalKey)) return jsonNoStore({ error: 'Not found' }, 404);

  const auth = await verifyPortalApiRequest(request, portalKey);
  if (!auth.authorized) return auth.response;

  const body = await readJsonBody(request);
  if (!body) return jsonNoStore({ error: 'Malformed JSON payload' }, 400);

  const account = await findPortalUserById(auth.user.portalUserId);
  if (!account || !(await verifyPassword(body.currentPassword, account.password_hash))) {
    return jsonNoStore({ error: 'Current password is incorrect', fieldErrors: { currentPassword: 'Incorrect password' } }, 400);
  }

  const passwordError = checkPassword(body.newPassword);
  if (passwordError) return jsonNoStore({ error: passwordError, fieldErrors: { newPassword: passwordError } }, 400);
  if (body.newPassword === body.currentPassword) {
    return jsonNoStore({ error: 'Choose a password different from the current one', fieldErrors: { newPassword: 'Same as current' } }, 400);
  }

  try {
    await setPortalUserPassword(account.portal_user_id, await hashPassword(body.newPassword));
    await revokeAllSessionsForUser(account.portal_user_id, auth.sessionTokenHash);
    return jsonNoStore({ success: true });
  } catch (err) {
    console.error('Password change error:', err.message);
    return jsonNoStore({ error: 'Could not change password' }, 500);
  }
}
