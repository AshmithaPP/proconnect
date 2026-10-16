import { verifyPortalApiSession, jsonNoStore } from '@/features/auth/api-guard';
import { getGoogleConnectionStatus } from '@/features/google/google-auth.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await verifyPortalApiSession(['superadmin', 'admin', 'consultant']);
  if (!auth.authorized) return auth.response;

  try {
    const status = await getGoogleConnectionStatus();
    return jsonNoStore(status);
  } catch (err) {
    console.error('[Google Status Error]:', err.message);
    return jsonNoStore({ error: 'Could not fetch Google Calendar status' }, 500);
  }
}
