/**
 * Worldline Connect connectivity check.
 *
 *   npm run worldline:check            → config + network + credentials (read-only)
 *   npm run worldline:check -- --create → also creates a ₹10 test hosted checkout and
 *                                         prints the real Worldline payment page URL
 *
 * Never prints the secret API key.
 * Note: Worldline's load balancer answers UNSIGNED requests with an HTML 403, so
 * reachability is only judged from a properly signed API call.
 */
import dns from 'dns/promises';
import connectSdk from 'connect-sdk-nodejs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const baseUrl = process.env.WORLDLINE_BASE_URL || 'https://api.preprod.connect.worldline-solutions.com';
const host = baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const merchantId = process.env.WORLDLINE_MERCHANT_ID || '';
const apiKeyId = process.env.WORLDLINE_API_KEY_ID || '';
const secretApiKey = process.env.WORLDLINE_SECRET_API_KEY || '';
const env = process.env.WORLDLINE_ENV || 'preprod';
const createCheckout = process.argv.includes('--create');

const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => console.log(`  ✗ ${msg}`);
const hint = (msg) => console.log(`    → ${msg}`);

async function main() {
  console.log('\n1. Configuration (.env.local)');
  console.log(`  API host      : ${host}`);
  console.log(`  Merchant ID   : ${merchantId || '(missing)'}`);
  console.log(`  API key ID    : ${apiKeyId || '(missing)'}`);
  console.log(`  Secret key    : ${secretApiKey ? 'set' : '(missing)'}`);
  console.log(`  WORLDLINE_ENV : ${env}${env === 'mock' ? '  (app uses the in-app simulator, not Worldline)' : ''}`);
  if (!['mock', 'preprod', 'production'].includes(env)) {
    bad(`WORLDLINE_ENV="${env}" is not a known value — use "mock", "preprod" or "production"`);
    hint('Anything other than "mock" disables the in-app simulator and calls real Worldline');
  }
  if (!merchantId || !apiKeyId || !secretApiKey) {
    bad('Merchant ID / API key ID / secret key missing');
    hint('Copy them from Configuration Center → Merchant IDs and API keys');
    return process.exit(1);
  }
  if (host.includes('.direct.')) {
    bad('This is a Worldline DIRECT host, but the app uses the CONNECT SDK');
    hint('Use api.preprod.connect.worldline-solutions.com (sandbox) or api.connect.worldline-solutions.com (live)');
    return process.exit(1);
  }

  console.log('\n2. DNS');
  try {
    const { address } = await dns.lookup(host);
    ok(`${host} resolves to ${address}`);
  } catch {
    bad(`${host} does not resolve — check the hostname`);
    return process.exit(1);
  }

  console.log('\n3. Network + credentials (signed GET /v1/{merchantId}/services/testconnection)');
  const client = connectSdk.init({
    host, scheme: 'https', port: 443, enableLogging: false,
    apiKeyId, secretApiKey, integrator: 'Insight-HCM-ProConnect',
  });
  try {
    const res = await client.v1.services.testconnection(merchantId, null);
    if (res.status !== 200) {
      const err = res.body?.errors?.[0];
      bad(`Worldline rejected the request: HTTP ${res.status} ${err ? `${err.code} ${err.id}` : ''}`);
      if (err?.id === 'MISSING_OR_INVALID_AUTHORIZATION') {
        hint('API key ID / secret do not match (check look-alike characters such as I vs l, O vs 0),');
        hint('or the key was revoked, or it belongs to another cluster');
      }
      if (err?.id === 'ACCESS_TO_MERCHANT_NOT_ALLOWED') hint('These keys are not linked to this merchant ID / platform');
      return process.exit(1);
    }
    ok(`Reached Worldline and credentials accepted (${res.body?.result || 'OK'})`);
  } catch (err) {
    // The SDK fails to parse an HTML body — that comes from the load balancer, not the API
    if (/Unexpected token '<'/.test(err.message)) {
      bad(`Blocked before reaching Worldline (HTTP ${err.status ?? '?'} HTML from the load balancer)`);
      hint('Signed requests are being refused at the network edge. Try another network, or ask Worldline support.');
    } else {
      bad(`Request failed: ${err.message}`);
      hint('Firewall / proxy / no internet?');
    }
    return process.exit(1);
  }

  if (!createCheckout) {
    console.log('\nAll checks passed. Set WORLDLINE_ENV=preprod in .env.local and restart the dev server.');
    console.log('Optional: npm run worldline:check -- --create   (opens a real ₹10 test payment page)\n');
    return;
  }

  console.log('\n4. Create a real ₹10 test hosted checkout');
  const res = await client.v1.hostedcheckouts.create(merchantId, {
    order: {
      amountOfMoney: { amount: 1000, currencyCode: 'INR' },
      customer: { billingAddress: { countryCode: 'IN' } },
      references: { merchantReference: `CHK${Date.now()}` },
    },
    hostedCheckoutSpecificInput: { locale: 'en_GB', returnUrl: 'https://example.com/worldline-check-done', showResultPage: true },
  }, null);
  if (!res.body?.hostedCheckoutId) {
    const err = res.body?.errors?.[0];
    bad(`Rejected: HTTP ${res.status} ${err ? `${err.code} ${err.id}${err.propertyName ? ` (${err.propertyName})` : ''}: ${err.message}` : ''}`);
    hint('Often a merchant setup issue (currency INR / payment products not enabled) — ask Worldline support');
    return process.exit(1);
  }
  ok(`hostedCheckoutId ${res.body.hostedCheckoutId}`);
  console.log('\n  Open this REAL Worldline payment page and pay with a Worldline test card:');
  console.log(`  https://${res.body.partialRedirectUrl.replace(/^https?:\/\//, '')}\n`);
}

main();
