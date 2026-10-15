import { verifyPortalApiRequest, jsonNoStore } from '@/features/auth/api-guard';
import { removeTimeOff } from '@/features/schedule/schedule.repository';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DELETE /api/consultant/time-off/{timeOffId} — available again (consultant or admin) */
export async function DELETE(request, { params }) {
  const auth = await verifyPortalApiRequest(request, ['consultant', 'admin']);
  if (!auth.authorized) return auth.response;

  const { timeOffId } = await params;
  if (!UUID_REGEX.test(timeOffId)) return jsonNoStore({ error: 'Not found' }, 404);

  try {
    const removed = await removeTimeOff(timeOffId);
    return removed ? jsonNoStore({ success: true }) : jsonNoStore({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('Time off delete error:', err.message);
    return jsonNoStore({ error: 'Could not save' }, 500);
  }
}
