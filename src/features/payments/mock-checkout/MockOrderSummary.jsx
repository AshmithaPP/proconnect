import React from 'react';
import styles from './mockCheckout.styles';

/**
 * Left column: order details plus developer buttons to simulate gateway outcomes.
 */
export default function MockOrderSummary({ name, email, bookingId, formattedAmount, currency, isProcessing, onSimulate }) {
  return (
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
          onClick={() => onSimulate('success')}
          disabled={isProcessing}
          style={{ ...styles.testBtn, ...styles.testBtnSuccess }}
        >
          ✓ Simulate Success (PAYMENT_CREATED)
        </button>
        <button
          type="button"
          onClick={() => onSimulate('fail')}
          disabled={isProcessing}
          style={{ ...styles.testBtn, ...styles.testBtnFail }}
        >
          ✗ Simulate Bank Decline
        </button>
        <button
          type="button"
          onClick={() => onSimulate('cancel')}
          disabled={isProcessing}
          style={{ ...styles.testBtn, ...styles.testBtnCancel }}
        >
          ⊘ Simulate User Cancel
        </button>
      </div>
    </div>
  );
}
