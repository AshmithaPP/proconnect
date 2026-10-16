import { verifyPortalApiSession, jsonNoStore } from '@/features/auth/api-guard';
import { getConsultantAccount } from '@/features/auth/portal-user.repository';
import { getPaidBookingStats } from '@/features/booking/booking.repository';
import { getBookingRules } from '@/features/schedule/schedule.repository';
import { getPaymentMode, getWorldlineConfig } from '@/features/payments/payment.config';
import { formatAmount } from '@/features/payments/format-amount';

export const dynamic = 'force-dynamic';

/**
 * GET /api/superadmin/overview
 * Delivers platform KPI cards dynamically for the Super Admin dashboard.
 */
export async function GET() {
  const auth = await verifyPortalApiSession(['superadmin']);
  if (!auth.authorized) return auth.response;

  try {
    const [consultant, stats, bookingRules] = await Promise.all([
      getConsultantAccount(),
      getPaidBookingStats(),
      getBookingRules(),
    ]);

    const paymentMode = getPaymentMode();
    const isSandbox = getWorldlineConfig().baseUrl.includes('.preprod.');

    return jsonNoStore({
      success: true,
      timestamp: new Date().toISOString(),
      kpis: {
        adminAccount: {
          exists: Boolean(consultant),
          fullName: consultant ? consultant.fullName : 'Not created',
          email: consultant ? consultant.email : 'Create the admin account',
          status: consultant ? consultant.accountStatus : 'missing',
        },
        paymentGateway: {
          mode: paymentMode,
          isSandbox,
          badge: paymentMode === 'worldline' ? (isSandbox ? 'Sandbox' : 'Live') : 'Off',
          name: paymentMode === 'worldline' ? 'Worldline' : 'Disabled',
          detail: paymentMode === 'worldline'
            ? (isSandbox ? 'Pre-production test payments' : 'Live payments')
            : 'PAYMENT_MODE is not set',
        },
        consultationFee: {
          currency: 'INR',
          amountPaise: bookingRules.consultationFeePaise,
          formatted: formatAmount(bookingRules.consultationFeePaise),
        },
        paidBookings: {
          count: stats.paidBookingCount,
          totalRevenuePaise: stats.totalRevenuePaise,
          formattedRevenue: formatAmount(stats.totalRevenuePaise),
        },
      },
    });
  } catch (err) {
    console.error('[Super Admin Overview API] Error:', err.message);
    return jsonNoStore({ error: 'Could not load platform overview data' }, 500);
  }
}
