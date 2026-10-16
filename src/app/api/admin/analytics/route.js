import { verifyPortalApiSession, jsonNoStore } from '@/features/auth/api-guard';
import { getConsultantAnalytics, ANALYTICS_RANGES } from '@/features/analytics/analytics.repository';
import { retryPendingReschedules } from '@/features/reschedule/reschedule.service';

/**
 * GET /api/admin/analytics?range=7|30|90 — platform admin or consultant
 * Delivers full business analytics for the admin portal dashboard via backend API.
 */
export async function GET(request) {
  const auth = await verifyPortalApiSession(['superadmin', 'admin', 'consultant']);
  if (!auth.authorized) return auth.response;

  const range = Number(new URL(request.url).searchParams.get('range'));
  const rangeDays = ANALYTICS_RANGES.includes(range) ? range : 30;

  try {
    await retryPendingReschedules();
    const data = await getConsultantAnalytics({ rangeDays });
    return jsonNoStore(data);
  } catch (err) {
    console.error('[Admin Analytics API] Error:', err.message);
    return jsonNoStore({ error: 'Could not load analytics data' }, 500);
  }
}
