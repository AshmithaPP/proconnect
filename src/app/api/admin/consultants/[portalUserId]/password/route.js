import { verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import { checkPassword } from '@/features/auth/account.schema';
import { hashPassword } from '@/features/auth/password';
import { findPortalUserById, setPortalUserPassword, revokeAllSessionsForUser } from '@/features/auth/portal-user.repository';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PUT /api/admin/consultants/{portalUserId}/password — admin only
 * Body: { password } — sets a new password and signs the consultant out everywhere.
 */
export async function PUT(request, { params }) {
  const auth = await verifyPortalApiRequest(request, 'admin');
  if (!auth.authorized) return auth.response;

  const { portalUserId } = await params;
  const account = UUID_REGEX.test(portalUserId) ? await findPortalUserById(portalUserId) : null;
  if (!account || account.user_role !== 'consultant') return jsonNoStore({ error: 'Consultant not found' }, 404);

  const body = await readJsonBody(request);
  const passwordError = checkPassword(body?.password);
  if (passwordError) return jsonNoStore({ error: passwordError, fieldErrors: { password: passwordError } }, 400);

  try {
    await setPortalUserPassword(portalUserId, await hashPassword(body.password));
    await revokeAllSessionsForUser(portalUserId);
    return jsonNoStore({ success: true });
  } catch (err) {
    console.error('Consultant password reset error:', err.message);
    return jsonNoStore({ error: 'Could not reset password' }, 500);
  }
}
