import { verifyPortalApiRequest, jsonNoStore } from '@/features/auth/api-guard';
import { testGoogleCalendarConnection } from '@/features/google/google-calendar.service';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await verifyPortalApiRequest(request, ['superadmin', 'admin', 'consultant']);
  if (!auth.authorized) return auth.response;

  try {
    const result = await testGoogleCalendarConnection();
    if (!result.success) {
      return jsonNoStore({ error: result.error || 'Google Meet test failed' }, 400);
    }
    return jsonNoStore(result);
  } catch (err) {
    console.error('[Google Test Error]:', err.message);
    return jsonNoStore({ error: err.message }, 500);
  }
}
