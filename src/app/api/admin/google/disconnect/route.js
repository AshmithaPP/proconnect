import { verifyPortalApiRequest, jsonNoStore } from '@/features/auth/api-guard';
import { disconnectGoogleAccount } from '@/features/google/google-auth.service';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await verifyPortalApiRequest(request, ['superadmin', 'admin', 'consultant']);
  if (!auth.authorized) return auth.response;

  try {
    await disconnectGoogleAccount(auth.user.portalUserId);
    return jsonNoStore({ success: true });
  } catch (err) {
    console.error('[Google Disconnect Error]:', err.message);
    return jsonNoStore({ error: 'Could not disconnect Google account' }, 500);
  }
}
