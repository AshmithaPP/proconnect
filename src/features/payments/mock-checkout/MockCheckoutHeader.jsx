import React from 'react';
import styles from './mockCheckout.styles';

export default function MockCheckoutHeader() {
  return (
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
  );
}
