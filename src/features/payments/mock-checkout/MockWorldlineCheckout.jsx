'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './mockCheckout.styles';
import MockCheckoutHeader from './MockCheckoutHeader';
import MockOrderSummary from './MockOrderSummary';
import MockPaymentMethods from './MockPaymentMethods';

/**
 * In-app Worldline Hosted Checkout simulator. Reads the session context from the
 * query string and redirects back to the gateway return URL with the chosen outcome.
 */
export default function MockWorldlineCheckout() {
  const searchParams = useSearchParams();

  const hostedCheckoutId = searchParams.get('hostedCheckoutId') || 'MOCK_WL_SESSION';
  const bookingId = searchParams.get('bookingId') || '';
  const rawAmount = searchParams.get('amount') || '99900';
  const currency = searchParams.get('currency') || 'INR';
  const email = searchParams.get('email') || 'client@example.com';
  const name = searchParams.get('name') || 'Valued Client';
  const returnUrl = searchParams.get('returnUrl') || '/api/payments/worldline/return';
  const apiNotice = searchParams.get('notice');

  const formattedAmount = (Number(rawAmount) / 100).toFixed(2);

  const [isProcessing, setIsProcessing] = useState(false);

  const completeSimulation = (action = 'success') => {
    setIsProcessing(true);
    setTimeout(() => {
      const url = new URL(returnUrl, window.location.origin);
      url.searchParams.set('hostedCheckoutId', hostedCheckoutId);
      url.searchParams.set('bookingId', bookingId);
      url.searchParams.set('RETURNMAC', `MAC_${Date.now()}`);
      if (action !== 'success') {
        url.searchParams.set('action', action);
      }
      window.location.href = url.toString();
    }, 1200);
  };

  return (
    <div style={styles.container}>
      <MockCheckoutHeader />

      {/* Main Checkout Container */}
      <main style={styles.main}>
        {apiNotice && (
          <div style={styles.sandboxNotice}>
            <strong>Worldline Sandbox Notice:</strong> {apiNotice}
            <div style={{ fontSize: '0.82rem', marginTop: '4px', opacity: 0.9 }}>
              Running in Worldline Hosted Simulator mode. All transactions seamlessly execute and persist to your MySQL database.
            </div>
          </div>
        )}

        <div style={styles.checkoutGrid}>
          <MockOrderSummary
            name={name}
            email={email}
            bookingId={bookingId}
            formattedAmount={formattedAmount}
            currency={currency}
            isProcessing={isProcessing}
            onSimulate={completeSimulation}
          />
          <MockPaymentMethods
            name={name}
            formattedAmount={formattedAmount}
            isProcessing={isProcessing}
            onSimulate={completeSimulation}
          />
        </div>
      </main>
    </div>
  );
}
