import { verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import { checkPassword } from '@/features/auth/account.schema';
import { hashPassword } from '@/features/auth/password';
import { getConsultantAccount, setPortalUserPassword, revokeAllSessionsForUser } from '@/features/auth/portal-user.repository';

/**
 * PUT /api/admin/consultant/password — admin only
 * Body: { password } — sets a new password for the consultant and signs them out everywhere.
 */
export async function PUT(request) {
  const auth = await verifyPortalApiRequest(request, 'superadmin');
  if (!auth.authorized) return auth.response;

  const body = await readJsonBody(request);
  const passwordError = checkPassword(body?.password);
  if (passwordError) return jsonNoStore({ error: passwordError, fieldErrors: { password: passwordError } }, 400);

  try {
    const consultant = await getConsultantAccount();
    if (!consultant) return jsonNoStore({ error: 'No consultant account yet' }, 404);
    await setPortalUserPassword(consultant.portalUserId, await hashPassword(body.password));
    await revokeAllSessionsForUser(consultant.portalUserId);
    return jsonNoStore({ success: true });
  } catch (err) {
    console.error('Consultant password reset error:', err.message);
    return jsonNoStore({ error: 'Could not reset the password' }, 500);
  }
}
