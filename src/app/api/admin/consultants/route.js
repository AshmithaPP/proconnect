import { verifyPortalApiSession, verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import { validateAccountInput } from '@/features/auth/account.schema';
import { hashPassword } from '@/features/auth/password';
import { listPortalUsersByRole, createPortalUser } from '@/features/auth/portal-user.repository';

/**
 * GET  /api/admin/consultants — list consultant accounts
 * POST /api/admin/consultants — create one { fullName, email, password }
 * Admin only.
 */
export async function GET() {
  const auth = await verifyPortalApiSession('admin');
  if (!auth.authorized) return auth.response;

  try {
    return jsonNoStore({ consultants: await listPortalUsersByRole('consultant') });
  } catch (err) {
    console.error('Consultant list error:', err.message);
    return jsonNoStore({ error: 'Could not load consultants' }, 500);
  }
}

export async function POST(request) {
  const auth = await verifyPortalApiRequest(request, 'admin');
  if (!auth.authorized) return auth.response;

  const body = await readJsonBody(request);
  if (!body) return jsonNoStore({ error: 'Malformed JSON payload' }, 400);

  const { value, fieldErrors } = validateAccountInput(body, { requirePassword: true });
  if (Object.keys(fieldErrors).length) {
    return jsonNoStore({ error: 'Please fix the highlighted fields', fieldErrors }, 400);
  }

  try {
    const result = await createPortalUser({
      fullName: value.fullName,
      email: value.email,
      passwordHash: await hashPassword(value.password),
      userRole: 'consultant',
    });
    if (result.outcome === 'email_taken') {
      return jsonNoStore({ error: 'This email is already used by another account', fieldErrors: { email: 'Already in use' } }, 409);
    }
    return jsonNoStore({ success: true, portalUserId: result.portalUserId }, 201);
  } catch (err) {
    console.error('Consultant create error:', err.message);
    return jsonNoStore({ error: 'Could not create consultant' }, 500);
  }
}
