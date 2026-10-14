'use client';

import React, { useState } from 'react';
import styles from './mockCheckout.styles';

const BANKS = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'PNB'];

/**
 * Right column: card / UPI / net-banking tabs. Inputs are cosmetic; the Pay
 * button always simulates a successful payment.
 */
export default function MockPaymentMethods({ name, formattedAmount, isProcessing, onSimulate }) {
  const [activeTab, setActiveTab] = useState('card');
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [cardHolder, setCardHolder] = useState(name);
  const [upiId, setUpiId] = useState('client@okhdfcbank');
  const [selectedBank, setSelectedBank] = useState('HDFC');

  return (
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
              {BANKS.map((bank) => (
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
            onClick={() => onSimulate('success')}
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
  );
}
