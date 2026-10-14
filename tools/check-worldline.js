/**
 * Worldline Connect connectivity check.
 *
 *   npm run worldline:check            → config + network + credentials (read-only)
 *   npm run worldline:check -- --create → also creates a ₹10 test hosted checkout and
 *                                         prints the real Worldline payment page URL
 *
 * Never prints the secret API key.
 */
import dns from 'dns/promises';
import https from 'https';
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

function probe(hostname) {
  return new Promise((resolve) => {
    const req = https.get({ hostname, path: `/v1/${merchantId || '0'}/services/testconnection`, timeout: 15000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, server: res.headers.server || '', body }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err) => resolve({ error: err.message }));
  });
}

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

  console.log('\n3. Network reachability (unauthenticated request)');
  const p = await probe(host);
  if (p.error) {
    bad(`Connection failed: ${p.error}`);
    hint('Firewall / proxy / no internet. Try another network.');
    return process.exit(1);
  }
  if (p.body.includes('MISSING_OR_INVALID_AUTHORIZATION') || p.body.trim().startsWith('{')) {
    ok(`Reached the Worldline Connect API (HTTP ${p.status} JSON, as expected without credentials)`);
  } else {
    bad(`Blocked before reaching Worldline: HTTP ${p.status} from "${p.server || 'unknown'}" (HTML, not API JSON)`);
    hint('Your network/IP is being refused by Worldline\'s load balancer. Fix options:');
    hint('a) Ask Worldline support to allow your public IP for pre-production API access');
    hint('b) Run this check from another network (office, mobile hotspot, cloud server, VPN)');
    return process.exit(1);
  }

  console.log('\n4. Credentials (GET /v1/{merchantId}/services/testconnection)');
  const client = connectSdk.init({
    host, scheme: 'https', port: 443, enableLogging: false,
    apiKeyId, secretApiKey, integrator: 'Insight-HCM-ProConnect',
  });
  try {
    const res = await client.v1.services.testconnection(merchantId, null);
    if (res.status !== 200) {
      const err = res.body?.errors?.[0];
      bad(`Rejected: HTTP ${res.status} ${err ? `${err.code} ${err.id}` : ''}`);
      if (err?.id === 'MISSING_OR_INVALID_AUTHORIZATION') hint('API key ID / secret wrong, revoked, or for another cluster');
      if (err?.id === 'ACCESS_TO_MERCHANT_NOT_ALLOWED') hint('These keys are not linked to this merchant ID / platform');
      return process.exit(1);
    }
    ok(`Credentials accepted (${res.body?.result || 'OK'})`);
  } catch (err) {
    bad(`Request failed: ${err.message}`);
    return process.exit(1);
  }

  if (!createCheckout) {
    console.log('\nAll checks passed. Set WORLDLINE_ENV=preprod in .env.local and restart the dev server.');
    console.log('Optional: npm run worldline:check -- --create   (opens a real ₹10 test payment page)\n');
    return;
  }

  console.log('\n5. Create a real ₹10 test hosted checkout');
  const res = await client.v1.hostedcheckouts.create(merchantId, {
    order: {
      amountOfMoney: { amount: 1000, currencyCode: 'INR' },
      customer: { billingAddress: { countryCode: 'IN' } },
      references: { merchantReference: `connectivity-check-${Date.now()}` },
    },
    hostedCheckoutSpecificInput: { locale: 'en_GB', returnUrl: 'https://example.com/worldline-check-done', showResultPage: true },
  }, null);
  if (res.status !== 201 && !res.body?.hostedCheckoutId) {
    const err = res.body?.errors?.[0];
    bad(`Rejected: HTTP ${res.status} ${err ? `${err.code} ${err.id}${err.propertyName ? ` (${err.propertyName})` : ''}: ${err.message}` : ''}`);
    hint('Often a merchant setup issue (currency INR / payment products not enabled) — ask Worldline support');
    return process.exit(1);
  }
  const partial = res.body.partialRedirectUrl;
  ok(`hostedCheckoutId ${res.body.hostedCheckoutId}`);
  console.log(`\n  Open this REAL Worldline payment page and pay with a Worldline test card:`);
  console.log(`  https://${partial.replace(/^https?:\/\//, '')}\n`);
}

main();
