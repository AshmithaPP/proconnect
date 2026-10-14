'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function MockWorldlineCheckoutContent() {
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

  const [activeTab, setActiveTab] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [cardHolder, setCardHolder] = useState(name);
  const [upiId, setUpiId] = useState('client@okhdfcbank');
  const [selectedBank, setSelectedBank] = useState('HDFC');

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
      {/* Top Banner with Worldline Branding */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brandGroup}>
            <div style={styles.logoBadge}>WORLDLINE <span style={{ color: '#00A3E0' }}>///</span></div>
            <span style={styles.subBrand}>Online Payments Pre-Production Sandbox</span>
          </div>
          <div style={styles.secureBadge}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>256-bit SSL Encrypted</span>
          </div>
        </div>
      </header>

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
          {/* Left Column: Order Summary */}
          <div style={styles.orderSummaryCard}>
            <h3 style={styles.summaryTitle}>Consultation Order</h3>
            <div style={styles.merchantMeta}>
              <span style={styles.metaLabel}>Merchant:</span>
              <span style={styles.metaValue}>Insight HCM ProConnect</span>
            </div>
            <div style={styles.merchantMeta}>
              <span style={styles.metaLabel}>Client:</span>
              <span style={styles.metaValue}>{name}</span>
            </div>
            <div style={styles.merchantMeta}>
              <span style={styles.metaLabel}>Email:</span>
              <span style={styles.metaValue}>{email}</span>
            </div>
            <div style={styles.merchantMeta}>
              <span style={styles.metaLabel}>Order Ref:</span>
              <span style={styles.metaValue}>{bookingId ? bookingId.slice(0, 8) + '...' : 'REF_1082'}</span>
            </div>

            <div style={styles.divider} />

            <div style={styles.totalRow}>
              <span>Total to Pay:</span>
              <span style={styles.totalAmount}>₹{formattedAmount} {currency}</span>
            </div>

            {/* Quick Test Toolbar */}
            <div style={styles.testToolbar}>
              <div style={styles.testToolbarTitle}>Developer Test Scenarios:</div>
              <button
                type="button"
                onClick={() => completeSimulation('success')}
                disabled={isProcessing}
                style={{ ...styles.testBtn, ...styles.testBtnSuccess }}
              >
                ✓ Simulate Success (PAYMENT_CREATED)
              </button>
              <button
                type="button"
                onClick={() => completeSimulation('fail')}
                disabled={isProcessing}
                style={{ ...styles.testBtn, ...styles.testBtnFail }}
              >
                ✗ Simulate Bank Decline
              </button>
              <button
                type="button"
                onClick={() => completeSimulation('cancel')}
                disabled={isProcessing}
                style={{ ...styles.testBtn, ...styles.testBtnCancel }}
              >
                ⊘ Simulate User Cancel
              </button>
            </div>
          </div>

          {/* Right Column: Payment Tabs */}
          <div style={styles.paymentMethodsCard}>
            <div style={styles.tabBar}>
              <button
                type="button"
                onClick={() => setActiveTab('card')}
                style={activeTab === 'card' ? styles.tabActive : styles.tab}
              >
                Credit / Debit Card
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('upi')}
                style={activeTab === 'upi' ? styles.tabActive : styles.tab}
              >
                UPI (GPay / PhonePe)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('netbanking')}
                style={activeTab === 'netbanking' ? styles.tabActive : styles.tab}
              >
                Net Banking
              </button>
            </div>

            <div style={styles.tabContent}>
              {/* TAB 1: CARD */}
              {activeTab === 'card' && (
                <div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      style={styles.input}
                    />
                    <span style={styles.hint}>Pre-filled with Worldline Test Visa Card</span>
                  </div>

                  <div style={styles.fieldRow}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Expiry Date</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        style={styles.input}
                        placeholder="MM/YY"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>CVV</label>
                      <input
                        type="password"
                        maxLength="4"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        style={styles.input}
                        placeholder="123"
                      />
                    </div>
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Name on Card</label>
                    <input
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: UPI */}
              {activeTab === 'upi' && (
                <div>
                  <div style={styles.qrBox}>
                    <div style={styles.qrCodePlaceholder}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#002D62' }}>[ Simulated UPI QR ]</span>
                      <span style={{ fontSize: '0.74rem', color: '#666', marginTop: '4px' }}>Scan with GPay / Paytm / PhonePe</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', margin: '14px 0', color: '#888', fontSize: '0.85rem' }}>— OR ENTER UPI ID —</div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Virtual Payment Address (VPA)</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      style={styles.input}
                      placeholder="username@okhdfcbank"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: NETBANKING */}
              {activeTab === 'netbanking' && (
                <div>
                  <label style={styles.label}>Select Your Bank</label>
                  <div style={styles.bankGrid}>
                    {['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'PNB'].map((bank) => (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => setSelectedBank(bank)}
                        style={{
                          ...styles.bankTile,
                          ...(selectedBank === bank ? styles.bankTileActive : {}),
                        }}
                      >
                        {bank} Bank
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pay Button */}
              <div style={{ marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => completeSimulation('success')}
                  disabled={isProcessing}
                  style={styles.payBtn}
                >
                  {isProcessing ? 'Processing with Bank...' : `Pay ₹${formattedAmount} via Worldline`}
                </button>
              </div>

              <div style={styles.footerGuarantees}>
                <span>🔒 PCI-DSS Compliant</span>
                <span>🛡️ 3D Secure OTP</span>
                <span>⚡ Real-Time Webhook</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f4f6fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#1a1f36',
  },
  header: {
    background: '#002D62',
    color: '#ffffff',
    padding: '16px 24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  },
  headerInner: {
    maxWidth: '1000px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
  },
  logoBadge: {
    fontSize: '1.25rem',
    fontWeight: '800',
    letterSpacing: '1px',
    color: '#ffffff',
  },
  subBrand: {
    fontSize: '0.82rem',
    color: '#cbd5e1',
    fontWeight: '500',
  },
  secureBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    background: 'rgba(255,255,255,0.1)',
    padding: '6px 12px',
    borderRadius: '20px',
  },
  main: {
    maxWidth: '1000px',
    margin: '32px auto',
    padding: '0 20px',
  },
  sandboxNotice: {
    background: '#e0f2fe',
    border: '1px solid #7dd3fc',
    color: '#0369a1',
    padding: '12px 18px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '0.9rem',
  },
  checkoutGrid: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '24px',
  },
  orderSummaryCard: {
    background: '#ffffff',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
    height: 'fit-content',
  },
  summaryTitle: {
    margin: '0 0 16px 0',
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#002D62',
  },
  merchantMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.86rem',
    marginBottom: '10px',
  },
  metaLabel: {
    color: '#64748b',
  },
  metaValue: {
    fontWeight: '600',
    color: '#0f172a',
  },
  divider: {
    height: '1px',
    background: '#e2e8f0',
    margin: '16px 0',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '1rem',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: '1.35rem',
    fontWeight: '800',
    color: '#002D62',
  },
  testToolbar: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px dashed #cbd5e1',
  },
  testToolbarTitle: {
    fontSize: '0.78rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: '10px',
    letterSpacing: '0.5px',
  },
  testBtn: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '0.8rem',
    borderRadius: '6px',
    cursor: 'pointer',
    border: 'none',
    marginBottom: '8px',
    fontWeight: '600',
    textAlign: 'left',
  },
  testBtnSuccess: {
    background: '#dcfce7',
    color: '#15803d',
  },
  testBtnFail: {
    background: '#fee2e2',
    color: '#b91c1c',
  },
  testBtnCancel: {
    background: '#f1f5f9',
    color: '#475569',
  },
  paymentMethodsCard: {
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  tab: {
    flex: 1,
    padding: '14px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.92rem',
    fontWeight: '600',
    color: '#64748b',
    borderBottom: '3px solid transparent',
  },
  tabActive: {
    flex: 1,
    padding: '14px 16px',
    background: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.92rem',
    fontWeight: '700',
    color: '#002D62',
    borderBottom: '3px solid #002D62',
  },
  tabContent: {
    padding: '28px',
  },
  fieldGroup: {
    marginBottom: '18px',
  },
  fieldRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    fontSize: '0.84rem',
    fontWeight: '600',
    marginBottom: '6px',
    color: '#334155',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    fontSize: '0.95rem',
    border: '1.5px solid #cbd5e1',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  hint: {
    display: 'block',
    fontSize: '0.74rem',
    color: '#94a3b8',
    marginTop: '4px',
  },
  qrBox: {
    display: 'flex',
    justifyContent: 'center',
    padding: '16px 0',
  },
  qrCodePlaceholder: {
    width: '200px',
    height: '200px',
    border: '2px dashed #002D62',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#f8fafc',
    textAlign: 'center',
    padding: '16px',
    boxSizing: 'border-box',
  },
  bankGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginTop: '10px',
  },
  bankTile: {
    padding: '14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    background: '#ffffff',
    cursor: 'pointer',
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    fontSize: '0.88rem',
  },
  bankTileActive: {
    border: '2px solid #002D62',
    background: '#f0f7ff',
    color: '#002D62',
  },
  payBtn: {
    width: '100%',
    padding: '15px 24px',
    background: '#002D62',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.05rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  footerGuarantees: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.76rem',
    color: '#64748b',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #f1f5f9',
  },
};

export default function MockWorldlineCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Loading Worldline Checkout Session...</p>
        </div>
      }
    >
      <MockWorldlineCheckoutContent />
    </Suspense>
  );
}
