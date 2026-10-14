import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isMockGatewayEnabled } from '@/features/payments/payment.config';
import MockWorldlineCheckout from '@/features/payments/mock-checkout/MockWorldlineCheckout';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * In-app Worldline checkout simulator — exists only when WORLDLINE_ENV=mock.
 */
export default function MockWorldlineCheckoutPage() {
  if (!isMockGatewayEnabled()) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Loading Worldline Checkout Session...</p>
        </div>
      }
    >
      <MockWorldlineCheckout />
    </Suspense>
  );
}
