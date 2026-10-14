/**
 * End-to-end verification script for Worldline Hosted Checkout flow.
 * Usage: node scripts/test-worldline-flow.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';
const ORIGIN = BASE_URL;

async function runTest() {
  console.log('--- TESTING WORLDLINE PAYMENT FLOW ---');

  // Step 1: Create a booking
  const uniqueEmail = `wl.test.${Date.now()}@example.com`;
  console.log('1. Submitting consultation booking for:', uniqueEmail);

  const bookingRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      fullName: 'Anita Sharma',
      companyName: 'TechVision Global',
      workEmail: uniqueEmail,
      phoneNumber: '+91 98765 12345',
      role: 'Founder / Business Owner',
      roleOther: '',
      teamSize: '6–10 people',
      challenge: 'Low lead conversion',
      challengeOther: '',
      timeSlot: '2:00 PM – 2:30 PM',
    }),
  });

  const bookingData = await bookingRes.json();
  if (!bookingRes.ok) {
    console.error('FAILED to create booking:', bookingData);
    process.exit(1);
  }

  const { bookingId } = bookingData.booking;
  console.log('✓ Booking created successfully! UUID:', bookingId);
  console.log('  Payment Mode:', bookingData.paymentMode);

  // Step 2: Initialize Worldline Checkout
  console.log('\n2. Calling POST /api/payments/worldline/checkout...');
  const checkoutRes = await fetch(`${BASE_URL}/api/payments/worldline/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ bookingId }),
  });

  const checkoutData = await checkoutRes.json();
  if (!checkoutRes.ok) {
    console.error('FAILED checkout initiation:', checkoutData);
    process.exit(1);
  }

  console.log('✓ Checkout initiated successfully!');
  console.log('  Hosted Checkout ID:', checkoutData.hostedCheckoutId);
  console.log('  Redirect URL:', checkoutData.redirectUrl);
  console.log('  Is Mock / Simulator:', checkoutData.isMock);

  // Step 3: Simulate Return Callback with Dual Verification
  console.log('\n3. Simulating Gateway Callback: GET /api/payments/worldline/return...');
  const returnUrl = `${BASE_URL}/api/payments/worldline/return?hostedCheckoutId=${encodeURIComponent(
    checkoutData.hostedCheckoutId
  )}&bookingId=${encodeURIComponent(bookingId)}&RETURNMAC=test_mac`;

  const returnRes = await fetch(returnUrl, {
    method: 'GET',
    redirect: 'manual', // do not follow redirect so we can inspect headers
  });

  console.log('✓ Return response status:', returnRes.status);
  const location = returnRes.headers.get('location');
  console.log('  Redirect Location:', location);

  if (location && location.includes('status=success')) {
    console.log('✓ Verified: Return endpoint redirected to success receipt!');
  } else {
    console.error('FAILED: Unexpected redirect location:', location);
    process.exit(1);
  }

  // Step 4: Verify in database directly
  const { query } = await import('../lib/db.js');
  const bookingRows = await query(
    'SELECT booking_id, booking_status FROM consultation_bookings WHERE booking_id = ?',
    [bookingId]
  );
  const paymentRows = await query(
    'SELECT payment_id, payment_provider, provider_order_id, payment_status, paid_at FROM booking_payments WHERE booking_id = ?',
    [bookingId]
  );

  console.log('\n--- DATABASE VERIFICATION ---');
  console.log('Booking Table:', bookingRows[0]);
  console.log('Payment Table:', paymentRows[0]);

  if (
    bookingRows[0].booking_status === 'confirmed' &&
    paymentRows[0].payment_status === 'paid' &&
    paymentRows[0].payment_provider === 'worldline'
  ) {
    console.log('\n🎉 ALL TESTS PASSED: Worldline payment integration successfully verified end-to-end!');
    process.exit(0);
  } else {
    console.error('FAIL: Database record did not update to confirmed/paid!');
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
