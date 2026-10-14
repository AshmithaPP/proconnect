import 'server-only';
/**
 * ==============================================================================
 * WORLDLINE CONNECT PAYMENT GATEWAY INTEGRATION CLIENT
 * ==============================================================================
 * 
 * This module is the central bridge between our Next.js application and Worldline.
 * It manages:
 *  1. Initializing the Worldline Connect Server SDK (connect-sdk-nodejs).
 *  2. Calling the official "Create Hosted Checkout" endpoint (POST /v1/{merchantId}/hostedCheckouts).
 *  3. Calling the official "Get Hosted Checkout" endpoint (GET /v1/{merchantId}/hostedCheckouts/{hostedCheckoutId})
 *     to perform Dual Verification.
 *  4. Providing a built-in Mock Simulator, enabled ONLY when WORLDLINE_ENV=mock.
 */

import connectSdk from 'connect-sdk-nodejs';
import { getWorldlineConfig, isMockGatewayEnabled } from '@/features/payments/payment.config';

// Singleton instance to prevent re-initializing the SDK on every API request
let sdkClientInstance = null;

/**
 * Initializes and caches the official Worldline Connect SDK client.
 * 
 * @returns {import('connect-sdk-nodejs').Client}
 */
export function getWorldlineClient() {
  if (sdkClientInstance) {
    return sdkClientInstance;
  }

  const config = getWorldlineConfig();

  // The official host for Worldline Pre-Production / Sandbox
  const host = config.baseUrl.replace(/^https?:\/\//, '');

  sdkClientInstance = connectSdk.init({
    host,
    scheme: 'https',
    port: 443,
    enableLogging: process.env.NODE_ENV !== 'production',
    apiKeyId: config.apiKeyId,
    secretApiKey: config.secretApiKey,
    integrator: 'Insight-HCM-ProConnect',
  });

  return sdkClientInstance;
}

/**
 * Worldline (GlobalCollect platform) limits merchantReference to 30 characters, so the
 * 36-char booking UUID cannot be sent as-is. Use "PC" + the first 28 hex digits of the
 * UUID: deterministic, still unique in practice, and searchable in the Worldline portal.
 * (Bookings are matched back by hostedCheckoutId, never by this reference.)
 * @param {string} bookingId
 */
export function toMerchantReference(bookingId) {
  return `PC${bookingId.replace(/-/g, '').slice(0, 28).toUpperCase()}`;
}

/**
 * STEP 1: CREATE HOSTED CHECKOUT SESSION
 * 
 * Invokes Worldline's "Create Hosted Checkout" API:
 * POST /v1/{merchantId}/hostedCheckouts
 * 
 * @param {Object} params
 * @param {string} params.bookingId - Our internal database booking UUID
 * @param {number} params.amountPaise - Amount in smallest currency unit (e.g., 99900 = Rs 999.00)
 * @param {string} params.currencyCode - 3-letter ISO code, e.g. "INR" or "EUR"
 * @param {Object} params.customer - Customer details { fullName, email, phone, company }
 * @param {string} params.returnUrl - URL Worldline redirects the customer to after payment
 * 
 * @returns {Promise<{
 *   success: boolean,
 *   hostedCheckoutId: string,
 *   redirectUrl: string,
 *   returnMac?: string,
 *   isMock?: boolean
 * }>}
 */
export async function createHostedCheckoutSession({
  bookingId,
  amountPaise,
  currencyCode = 'INR',
  customer,
  returnUrl,
}) {
  const config = getWorldlineConfig();

  // Split full name into first name and surname for Worldline customer profile
  const nameParts = (customer.fullName || '').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Client';
  const surname = nameParts.slice(1).join(' ') || 'Customer';

  // Format the payload strictly according to Worldline's CreateHostedCheckoutRequest specification from API Explorer
  const requestBody = {
    order: {
      amountOfMoney: {
        amount: amountPaise,
        currencyCode: currencyCode,
      },
      customer: {
        billingAddress: {
          city: 'Hoofddorp',
          zip: '2132 JB',
          countryCode: 'IN',
          street: 'Neptunusstraat',
        },
        personalInformation: {
          name: {
            firstName: firstName,
            surname: surname,
          },
        },
        contactDetails: {
          emailAddress: customer.email,
          phoneNumber: customer.phone,
        },
      },
      references: {
        merchantReference: toMerchantReference(bookingId),
      },
    },
    hostedCheckoutSpecificInput: {
      variant: '100',
      locale: 'en_GB',
      returnUrl: returnUrl,
      showResultPage: false, // Redirect directly back to our returnUrl without extra Worldline confirmation screen
    },
  };

  // Simulator is used only when explicitly enabled (WORLDLINE_ENV=mock) — never as a fallback
  if (isMockGatewayEnabled()) {
    return createMockHostedCheckoutSession({ bookingId, amountPaise, currencyCode, customer, returnUrl });
  }

  try {
    const client = getWorldlineClient();

    // Call the official Worldline SDK: POST /v1/{merchantId}/hostedCheckouts
    // SDK returns { status: <HTTP status>, body: <API response>, isSuccess }
    const sdkResponse = await client.v1.hostedcheckouts.create(config.merchantId, requestBody, null);
    const response = sdkResponse?.body;

    // If Worldline rejected the request (non-2xx or no session ID)
    if (!sdkResponse?.isSuccess || !response?.hostedCheckoutId) {
      const err = response?.errors?.[0];
      const errMsg = err ? `${err.id}${err.propertyName ? ` (${err.propertyName})` : ''}: ${err.message}` : `HTTP ${sdkResponse?.status}`;
      throw new Error(`Worldline rejected hosted checkout creation: ${errMsg}`);
    }

    // Worldline returns:
    // {
    //   hostedCheckoutId: "90000005140000...",
    //   RETURNMAC: "...",
    //   partialRedirectUrl: "payment.preprod.direct.worldline-solutions.com/checkout/..."
    // }
    const partialUrl = response.partialRedirectUrl || '';
    const redirectUrl = partialUrl.startsWith('http')
      ? partialUrl
      : `https://${partialUrl.replace(/^\/+/, '')}`;

    return {
      success: true,
      hostedCheckoutId: response.hostedCheckoutId,
      returnMac: response.RETURNMAC,
      redirectUrl,
      isMock: false,
    };
  } catch (error) {
    // Never fall back to the simulator here: that would let customers "pay" without paying.
    // While sandbox credentials are being provisioned, set WORLDLINE_ENV=mock explicitly instead.
    const reason = error.body?.errors?.[0]?.message || error.message;
    console.error('[Worldline] Hosted checkout creation failed:', reason);
    throw new Error(`Worldline hosted checkout creation failed: ${reason}`);
  }
}

/**
 * STEP 2: GET HOSTED CHECKOUT STATUS (DUAL VERIFICATION)
 * 
 * Invokes Worldline's "Get Hosted Checkout" API:
 * GET /v1/{merchantId}/hostedCheckouts/{hostedCheckoutId}
 * 
 * This ensures we never trust client-side return redirects alone.
 * 
 * @param {string} hostedCheckoutId
 * @returns {Promise<{
 *   isPaid: boolean,       // money confirmed — safe to confirm the booking
 *   isFinalFailure: boolean, // definitively not paid — safe to release the slot
 *   status: string,
 *   paymentId?: string,
 *   amount?: number,
 *   currency?: string,
 *   isMock?: boolean
 * }>}
 * When neither flag is set (IN_PROGRESS, STATUS_UNKNOWN) the outcome is not known yet:
 * leave the booking pending — never cancel it, the customer may still be paying.
 */
export async function getHostedCheckoutStatus(hostedCheckoutId) {
  const isSimulatorSession = hostedCheckoutId.startsWith('MOCK_WL_') || hostedCheckoutId.startsWith('SIM_');

  // Simulator sessions are trusted only when the simulator is explicitly enabled
  if (isSimulatorSession && !isMockGatewayEnabled()) {
    return { isPaid: false, isFinalFailure: true, status: 'SIMULATOR_DISABLED', isMock: true };
  }

  if (isSimulatorSession) {
    return {
      isPaid: true,
      isFinalFailure: false,
      status: 'PAYMENT_CREATED',
      paymentId: `PAY_${hostedCheckoutId.replace('MOCK_WL_', '')}`,
      isMock: true,
    };
  }

  const config = getWorldlineConfig();
  const client = getWorldlineClient();

  try {
    // Call official Worldline SDK: GET /v1/{merchantId}/hostedCheckouts/{hostedCheckoutId}
    const sdkResponse = await client.v1.hostedcheckouts.get(config.merchantId, hostedCheckoutId, null);
    if (!sdkResponse?.isSuccess) {
      const err = sdkResponse?.body?.errors?.[0];
      throw new Error(`Worldline status lookup failed: ${err ? err.id : `HTTP ${sdkResponse?.status}`}`);
    }
    const response = sdkResponse.body;

    // Hosted checkout status values:
    // - "PAYMENT_CREATED": a payment object exists — its outcome is in paymentStatusCategory
    //     (SUCCESSFUL | REJECTED | STATUS_UNKNOWN). PAYMENT_CREATED alone does NOT mean paid.
    // - "IN_PROGRESS": customer is still on the hosted checkout page.
    // - "CANCELLED_BY_CONSUMER": customer pressed cancel on the Worldline page.
    // - "CLIENT_NOT_ELIGIBLE_FOR_SELECTED_PAYMENT_PRODUCT": payment product refused.
    const output = response.createdPaymentOutput;
    const payment = output?.payment;
    const category = output?.paymentStatusCategory;

    const isPaid = response.status === 'PAYMENT_CREATED' && category === 'SUCCESSFUL';
    const isFinalFailure =
      response.status === 'CANCELLED_BY_CONSUMER' ||
      response.status === 'CLIENT_NOT_ELIGIBLE_FOR_SELECTED_PAYMENT_PRODUCT' ||
      (response.status === 'PAYMENT_CREATED' && category === 'REJECTED');

    return {
      isPaid,
      isFinalFailure,
      status: category ? `${response.status}:${category}` : response.status,
      paymentId: payment?.id || hostedCheckoutId,
      amount: payment?.paymentOutput?.amountOfMoney?.amount,
      currency: payment?.paymentOutput?.amountOfMoney?.currencyCode,
      isMock: false,
    };
  } catch (error) {
    console.error('[Worldline] Status verification error:', error.message);
    throw error;
  }
}

/**
 * Helper: Generates a realistic mock checkout session pointing to our in-app Worldline simulator.
 */
function createMockHostedCheckoutSession({ bookingId, amountPaise, currencyCode, customer, returnUrl, apiNotice }) {
  const mockHostedCheckoutId = `MOCK_WL_${Date.now()}`;
  const mockReturnMac = `MAC_${Date.now()}`;

  // Encodes checkout context so our simulator displays accurate amount, customer, and booking details
  const params = new URLSearchParams({
    hostedCheckoutId: mockHostedCheckoutId,
    bookingId: bookingId,
    amount: String(amountPaise),
    currency: currencyCode,
    email: customer.email,
    name: customer.fullName || '',
    returnUrl: returnUrl,
    returnMac: mockReturnMac,
  });

  if (apiNotice) {
    params.set('notice', apiNotice);
  }

  return {
    success: true,
    hostedCheckoutId: mockHostedCheckoutId,
    returnMac: mockReturnMac,
    redirectUrl: `/mock-worldline/checkout?${params.toString()}`,
    isMock: true,
  };
}
