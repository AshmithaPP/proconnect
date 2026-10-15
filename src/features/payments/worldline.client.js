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
 */

import connectSdk from 'connect-sdk-nodejs';
import { getWorldlineConfig } from '@/features/payments/payment.config';

// Singleton instance to prevent re-initializing the SDK on every API request
let sdkClientInstance = null;

// Payment statuses where the money is (being) collected — safe to confirm a booking
const CAPTURED_PAYMENT_STATUSES = new Set(['CAPTURE_REQUESTED', 'CAPTURED', 'PAID']);

/**
 * The Worldline Connect API endpoints this app calls. The SDK builds these exact paths
 * (see node_modules/connect-sdk-nodejs/lib/v1/...) on WORLDLINE_BASE_URL and signs them;
 * they are listed here so every call (and every log line) shows which endpoint it hits.
 */
export const WORLDLINE_ENDPOINTS = {
  createHostedCheckout: (merchantId) => `POST /v1/${merchantId}/hostedcheckouts`,
  getHostedCheckout: (merchantId, hostedCheckoutId) => `GET /v1/${merchantId}/hostedcheckouts/${hostedCheckoutId}`,
  approvePayment: (merchantId, paymentId) => `POST /v1/${merchantId}/payments/${paymentId}/approve`,
};

/** "POST https://api.preprod.connect.worldline-solutions.com/v1/…" — for logs */
function describeEndpoint(endpoint) {
  const [method, path] = endpoint.split(' ');
  return `${method} ${getWorldlineConfig().baseUrl.replace(/\/+$/, '')}${path}`;
}

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
 * Hosted checkout page URL = "https://" + subdomain + "." + partialRedirectUrl.
 * The subdomain is configured in Configuration Center → Hosted payment pages → Subdomains
 * ("payment" by default); override with WORLDLINE_CHECKOUT_SUBDOMAIN.
 * @param {string} partialRedirectUrl
 */
export function buildHostedCheckoutUrl(partialRedirectUrl) {
  const subdomain = (process.env.WORLDLINE_CHECKOUT_SUBDOMAIN || 'payment').replace(/\.+$/, '');
  const partial = String(partialRedirectUrl || '').replace(/^https?:\/\//, '').replace(/^\/+/, '');
  return `https://${subdomain}.${partial}`;
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
 *   returnMac?: string
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
          countryCode: 'IN',
        },
        personalInformation: {
          name: {
            firstName: firstName,
            surname: surname,
          },
        },
        contactDetails: {
          emailAddress: customer.email,
          phoneNumber: String(customer.phone || '').replace(/[^\d+]/g, ''),
        },
      },
      references: {
        merchantReference: toMerchantReference(bookingId),
      },
    },
    // Direct sale: authorise AND capture in one step. Without this the sandbox merchant
    // only authorises (payment stays PENDING_APPROVAL) and the money is never collected.
    cardPaymentMethodSpecificInput: {
      requiresApproval: false,
    },
    hostedCheckoutSpecificInput: {
      variant: '100',
      locale: 'en_GB',
      returnUrl: returnUrl,
      showResultPage: false, // Redirect directly back to our returnUrl without extra Worldline confirmation screen
      // Offer cards only: other methods listed for INR on this account (e.g. PayPal 840) are
      // rejected by Worldline with NO_VALID_PROVIDERS_FOUND_FOR_COMBINATION.
      paymentProductFilters: {
        restrictTo: { groups: ['cards'] },
      },
    },
  };

  try {
    const client = getWorldlineClient();

    const endpoint = WORLDLINE_ENDPOINTS.createHostedCheckout(config.merchantId);
    console.log(`[Worldline] → ${describeEndpoint(endpoint)}`);
    // SDK returns { status: <HTTP status>, body: <API response>, isSuccess }
    const sdkResponse = await client.v1.hostedcheckouts.create(config.merchantId, requestBody, null);
    const response = sdkResponse?.body;
    console.log(`[Worldline] ← ${sdkResponse?.status} ${endpoint}`);

    // If Worldline rejected the request (non-2xx or no session ID)
    if (!sdkResponse?.isSuccess || !response?.hostedCheckoutId) {
      const err = response?.errors?.[0];
      const errMsg = err ? `${err.id}${err.propertyName ? ` (${err.propertyName})` : ''}: ${err.message}` : `HTTP ${sdkResponse?.status}`;
      throw new Error(`Worldline rejected ${endpoint}: ${errMsg}`);
    }

    // Worldline returns:
    // {
    //   hostedCheckoutId: "06acf449-...",
    //   RETURNMAC: "...",
    //   partialRedirectUrl: "pay1.preprod.checkout.worldline-solutions.com/checkout/..."
    // }
    // The full page URL is https://{merchant subdomain}.{partialRedirectUrl}. Without the
    // subdomain prefix Worldline answers "Page not found (404)".
    const redirectUrl = buildHostedCheckoutUrl(response.partialRedirectUrl);

    return {
      success: true,
      hostedCheckoutId: response.hostedCheckoutId,
      returnMac: response.RETURNMAC,
      redirectUrl,
    };
  } catch (error) {
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
 *   currency?: string
 * }>}
 * When neither flag is set (IN_PROGRESS, STATUS_UNKNOWN) the outcome is not known yet:
 * leave the booking pending — never cancel it, the customer may still be paying.
 */
export async function getHostedCheckoutStatus(hostedCheckoutId) {
  // IDs from the removed in-app simulator never existed at Worldline — never treat them as paid
  if (hostedCheckoutId.startsWith('MOCK_WL_') || hostedCheckoutId.startsWith('SIM_')) {
    return { isPaid: false, isFinalFailure: true, status: 'LEGACY_SIMULATOR_SESSION' };
  }

  const config = getWorldlineConfig();
  const client = getWorldlineClient();

  try {
    const endpoint = WORLDLINE_ENDPOINTS.getHostedCheckout(config.merchantId, hostedCheckoutId);
    console.log(`[Worldline] → ${describeEndpoint(endpoint)}`);
    const sdkResponse = await client.v1.hostedcheckouts.get(config.merchantId, hostedCheckoutId, null);
    console.log(`[Worldline] ← ${sdkResponse?.status} ${endpoint}`);
    if (!sdkResponse?.isSuccess) {
      const err = sdkResponse?.body?.errors?.[0];
      throw new Error(`Worldline rejected ${endpoint}: ${err ? err.id : `HTTP ${sdkResponse?.status}`}`);
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

    // SUCCESSFUL also covers an authorisation that was never captured (PENDING_APPROVAL),
    // so additionally require that capture has been requested or completed.
    const isPaid =
      response.status === 'PAYMENT_CREATED' &&
      category === 'SUCCESSFUL' &&
      CAPTURED_PAYMENT_STATUSES.has(payment?.status);
    const isFinalFailure =
      response.status === 'CANCELLED_BY_CONSUMER' ||
      response.status === 'CLIENT_NOT_ELIGIBLE_FOR_SELECTED_PAYMENT_PRODUCT' ||
      (response.status === 'PAYMENT_CREATED' && category === 'REJECTED');

    // Card approved but money not yet taken (merchant set to authorise-only): the caller
    // captures it with capturePayment() after checking the amount.
    const needsCapture =
      response.status === 'PAYMENT_CREATED' &&
      payment?.status === 'PENDING_APPROVAL' &&
      payment?.statusOutput?.isAuthorized === true;

    return {
      isPaid,
      isFinalFailure,
      needsCapture,
      status: category ? `${response.status}:${category}` : response.status,
      paymentId: payment?.id || hostedCheckoutId,
      amount: payment?.paymentOutput?.amountOfMoney?.amount,
      currency: payment?.paymentOutput?.amountOfMoney?.currencyCode,
    };
  } catch (error) {
    console.error('[Worldline] Status verification error:', error.message);
    throw error;
  }
}

/**
 * STEP 3 (only for authorise-only payments): CAPTURE
 *
 * Invokes Worldline's "Approve Payment" API:
 * POST /v1/{merchantId}/payments/{paymentId}/approve
 *
 * @param {string} paymentId
 * @param {number} amountPaise - full authorised amount
 * @returns {Promise<{ isPaid: boolean, status: string }>}
 */
export async function capturePayment(paymentId, amountPaise) {
  const config = getWorldlineConfig();
  const client = getWorldlineClient();

  const endpoint = WORLDLINE_ENDPOINTS.approvePayment(config.merchantId, paymentId);
  console.log(`[Worldline] → ${describeEndpoint(endpoint)}`);
  const sdkResponse = await client.v1.payments.approve(config.merchantId, paymentId, { amount: amountPaise }, null);
  console.log(`[Worldline] ← ${sdkResponse?.status} ${endpoint}`);
  if (!sdkResponse?.isSuccess) {
    const err = sdkResponse?.body?.errors?.[0];
    throw new Error(`Worldline rejected ${endpoint}: ${err ? err.id : `HTTP ${sdkResponse?.status}`}`);
  }
  const status = sdkResponse.body?.payment?.status;
  return { isPaid: CAPTURED_PAYMENT_STATUSES.has(status), status };
}
