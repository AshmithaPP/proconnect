import { verifyPortalApiSession, verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import { validateAccountInput } from '@/features/auth/account.schema';
import { hashPassword } from '@/features/auth/password';
import { getConsultantAccount, createPortalUser, updatePortalUser } from '@/features/auth/portal-user.repository';

/**
 * The single consultant account — admin only.
 *   GET  /api/admin/consultant — the account (or null if not created yet)
 *   POST /api/admin/consultant — create it { fullName, email, password } (only when none exists)
 *   PUT  /api/admin/consultant — change name / email { fullName, email }
 * Password reset: PUT /api/admin/consultant/password
 */
export async function GET() {
  const auth = await verifyPortalApiSession('superadmin');
  if (!auth.authorized) return auth.response;

  try {
    return jsonNoStore({ consultant: await getConsultantAccount() });
  } catch (err) {
    console.error('Consultant read error:', err.message);
    return jsonNoStore({ error: 'Could not load the consultant account' }, 500);
  }
}

export async function POST(request) {
  const auth = await verifyPortalApiRequest(request, 'superadmin');
  if (!auth.authorized) return auth.response;

  const body = await readJsonBody(request);
  if (!body) return jsonNoStore({ error: 'Malformed JSON payload' }, 400);

  const { value, fieldErrors } = validateAccountInput(body, { requirePassword: true });
  if (Object.keys(fieldErrors).length) return jsonNoStore({ error: 'Please fix the highlighted fields', fieldErrors }, 400);

  try {
    if (await getConsultantAccount()) {
      return jsonNoStore({ error: 'The consultant account already exists — edit it instead' }, 409);
    }
    const result = await createPortalUser({
      fullName: value.fullName,
      email: value.email,
      passwordHash: await hashPassword(value.password),
      userRole: 'consultant',
    });
    if (result.outcome === 'email_taken') {
      return jsonNoStore({ error: 'This email is already used by another account', fieldErrors: { email: 'Already in use' } }, 409);
    }
    return jsonNoStore({ success: true, consultant: await getConsultantAccount() }, 201);
  } catch (err) {
    console.error('Consultant create error:', err.message);
    return jsonNoStore({ error: 'Could not create the consultant account' }, 500);
  }
}

export async function PUT(request) {
  const auth = await verifyPortalApiRequest(request, 'superadmin');
  if (!auth.authorized) return auth.response;

  const body = await readJsonBody(request);
  if (!body) return jsonNoStore({ error: 'Malformed JSON payload' }, 400);

  const { value, fieldErrors } = validateAccountInput(body, { requirePassword: false });
  if (Object.keys(fieldErrors).length) return jsonNoStore({ error: 'Please fix the highlighted fields', fieldErrors }, 400);

  try {
    const consultant = await getConsultantAccount();
    if (!consultant) return jsonNoStore({ error: 'No consultant account yet' }, 404);

    const outcome = await updatePortalUser(consultant.portalUserId, 'consultant', { fullName: value.fullName, email: value.email });
    if (outcome === 'email_taken') {
      return jsonNoStore({ error: 'This email is already used by another account', fieldErrors: { email: 'Already in use' } }, 409);
    }
    return jsonNoStore({ success: true, consultant: await getConsultantAccount() });
  } catch (err) {
    console.error('Consultant update error:', err.message);
    return jsonNoStore({ error: 'Could not update the consultant account' }, 500);
  }
}
