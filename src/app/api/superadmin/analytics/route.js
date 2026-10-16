import { verifyPortalApiSession, jsonNoStore } from '@/features/auth/api-guard';
import { getConsultantAnalytics, ANALYTICS_RANGES } from '@/features/analytics/analytics.repository';
import { retryPendingReschedules } from '@/features/reschedule/reschedule.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/superadmin/analytics?range=7|30|90
 * Delivers full business analytics for the Super Admin portal dashboard dynamically from the database.
 */
export async function GET(request) {
  const auth = await verifyPortalApiSession(['superadmin']);
  if (!auth.authorized) return auth.response;

  const range = Number(new URL(request.url).searchParams.get('range'));
  const rangeDays = ANALYTICS_RANGES.includes(range) ? range : 30;

  try {
    await retryPendingReschedules();
    const data = await getConsultantAnalytics({ rangeDays });
    return jsonNoStore(data);
  } catch (err) {
    console.error('[Super Admin Analytics API] Error:', err.message);
    return jsonNoStore({ error: 'Could not load business analytics data' }, 500);
  }
}
