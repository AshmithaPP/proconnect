import { verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import { validateAccountInput } from '@/features/auth/account.schema';
import { updatePortalUser, revokeAllSessionsForUser } from '@/features/auth/portal-user.repository';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/admin/consultants/{portalUserId} — admin only
 * Body (any of): { fullName, email, accountStatus: 'active' | 'inactive' }
 * Deactivating signs the consultant out everywhere immediately.
 */
export async function PATCH(request, { params }) {
  const auth = await verifyPortalApiRequest(request, 'admin');
  if (!auth.authorized) return auth.response;

  const { portalUserId } = await params;
  if (!UUID_REGEX.test(portalUserId)) return jsonNoStore({ error: 'Consultant not found' }, 404);

  const body = await readJsonBody(request);
  if (!body) return jsonNoStore({ error: 'Malformed JSON payload' }, 400);

  const changes = {};
  const fieldErrors = {};
  if (body.fullName !== undefined || body.email !== undefined) {
    const { value, fieldErrors: accountErrors } = validateAccountInput(body, { requirePassword: false });
    Object.assign(fieldErrors, accountErrors);
    changes.fullName = value.fullName;
    changes.email = value.email;
  }
  if (body.accountStatus !== undefined) {
    if (!['active', 'inactive'].includes(body.accountStatus)) fieldErrors.accountStatus = 'Must be active or inactive';
    else changes.accountStatus = body.accountStatus;
  }
  if (Object.keys(fieldErrors).length) {
    return jsonNoStore({ error: 'Please fix the highlighted fields', fieldErrors }, 400);
  }

  try {
    const outcome = await updatePortalUser(portalUserId, 'consultant', changes);
    if (outcome === 'not_found') return jsonNoStore({ error: 'Consultant not found' }, 404);
    if (outcome === 'email_taken') {
      return jsonNoStore({ error: 'This email is already used by another account', fieldErrors: { email: 'Already in use' } }, 409);
    }
    if (changes.accountStatus === 'inactive') await revokeAllSessionsForUser(portalUserId);
    return jsonNoStore({ success: true });
  } catch (err) {
    console.error('Consultant update error:', err.message);
    return jsonNoStore({ error: 'Could not update consultant' }, 500);
  }
}
