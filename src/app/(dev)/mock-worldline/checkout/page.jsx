'use client';

import React, { Suspense } from 'react';
import MockWorldlineCheckout from '@/features/payments/mock-checkout/MockWorldlineCheckout';

export default function MockWorldlineCheckoutPage() {
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
