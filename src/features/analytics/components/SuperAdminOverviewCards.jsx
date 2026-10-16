'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FiRefreshCw, FiAlertCircle } from 'react-icons/fi';

/**
 * Platform KPI Cards for Super Admin.
 * Fetches all platform overview metrics dynamically from GET /api/superadmin/overview.
 * Inspectable in the browser Network (Fetch/XHR) tab.
 */
export default function SuperAdminOverviewCards({ onRefresh }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/superadmin/overview', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      setData(json.kpis);
    } catch (err) {
      console.error('[Overview Cards API] Error:', err);
      setError(err.message || 'Failed to load platform stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleManualRefresh = () => {
    fetchOverview();
    if (typeof onRefresh === 'function') {
      onRefresh();
    }
  };

  return (
    <div>
      {/* Header action with live refresh button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 14 }}>
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isLoading}
          className="btn-pro btn-sm btn-light"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '6px 12px' }}
        >
          <FiRefreshCw className={isLoading ? 'icon-spin' : ''} />
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && !data && (
        <div className="form-alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span>
            <FiAlertCircle className="icon-inline" style={{ marginRight: 6 }} />
            {error}
          </span>
          <button type="button" onClick={fetchOverview} className="btn-pro btn-sm btn-light">
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="admin-kpi-grid">
        {/* Card 1: Admin Account */}
        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Admin Account</span>
            <span className={`card-pill-tag${data?.adminAccount?.exists ? ' tag-green' : ''}`}>
              {isLoading && !data ? 'Loading…' : data?.adminAccount?.exists ? 'Set up' : 'Missing'}
            </span>
          </div>
          <div className="card-val">
            {isLoading && !data ? '—' : data?.adminAccount?.fullName || 'Not created'}
          </div>
          <div className="card-subtext">
            {isLoading && !data
              ? 'Fetching account…'
              : `${data?.adminAccount?.email || 'Create the admin account'} · `}
            <Link href="/superadmin/dashboard/consultant">Manage →</Link>
          </div>
        </div>

        {/* Card 2: Payment Gateway */}
        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Payment Gateway</span>
            <span className="card-pill-tag">
              {isLoading && !data ? '—' : data?.paymentGateway?.badge || 'Off'}
            </span>
          </div>
          <div className="card-val">
            {isLoading && !data ? '—' : data?.paymentGateway?.name || 'Disabled'}
          </div>
          <div className="card-subtext">
            {isLoading && !data ? 'Connecting gateway…' : data?.paymentGateway?.detail || 'Gateway status'}
          </div>
        </div>

        {/* Card 3: Consultation Fee */}
        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Consultation Fee</span>
            <span className="card-pill-tag">{data?.consultationFee?.currency || 'INR'}</span>
          </div>
          <div className="card-val">
            {isLoading && !data ? '—' : data?.consultationFee?.formatted || '₹0'}
          </div>
          <div className="card-subtext">Per booking · set in Schedule &amp; Pricing</div>
        </div>

        {/* Card 4: Paid Bookings */}
        <div className="admin-info-card">
          <div className="card-top-row">
            <span className="card-label">Paid Bookings</span>
            <span className="card-pill-tag">All time</span>
          </div>
          <div className="card-val">
            {isLoading && !data ? '—' : data?.paidBookings?.count ?? 0}
          </div>
          <div className="card-subtext">
            {isLoading && !data ? 'Calculating…' : `${data?.paidBookings?.formattedRevenue || '₹0'} collected`}
          </div>
        </div>
      </div>
    </div>
  );
}
