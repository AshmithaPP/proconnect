import { verifyPortalApiSession, jsonNoStore } from '@/features/auth/api-guard';
import { getConsultantAnalytics, ANALYTICS_RANGES } from '@/features/analytics/analytics.repository';
import { retryPendingReschedules } from '@/features/reschedule/reschedule.service';

/**
 * GET /api/consultant/analytics?range=7|30|90 — consultant or platform admin
 * KPIs, daily revenue, consultation-time heatmap, booking funnel, client breakdowns and the
 * upcoming week, in the business timezone.
 */
export async function GET(request) {
  const auth = await verifyPortalApiSession(['superadmin', 'admin', 'consultant']);
  if (!auth.authorized) return auth.response;

  const range = Number(new URL(request.url).searchParams.get('range'));
  const rangeDays = ANALYTICS_RANGES.includes(range) ? range : 30;

  try {
    await retryPendingReschedules();
    return jsonNoStore(await getConsultantAnalytics({ rangeDays }));
  } catch (err) {
    console.error('Analytics error:', err.message);
    return jsonNoStore({ error: 'Could not load analytics' }, 500);
  }
}
