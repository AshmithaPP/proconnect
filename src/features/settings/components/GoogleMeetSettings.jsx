'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { FiVideo, FiCheckCircle, FiAlertCircle, FiRefreshCw, FiExternalLink, FiTrash2 } from 'react-icons/fi';
import { formatDateLabel } from '@/features/schedule/slot-engine';

export default function GoogleMeetSettings({ portalKey = 'admin' }) {
  const searchParams = useSearchParams();
  const connectUrl = `/api/admin/google/connect?portal=${portalKey}`;
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [message, setMessage] = useState(() => {
    if (searchParams.get('connected') === 'true') {
      return { type: 'success', text: 'Google Calendar and Meet connected successfully!' };
    }
    const err = searchParams.get('error');
    if (err) {
      return { type: 'error', text: `Google authorization failed: ${decodeURIComponent(err)}` };
    }
    return null;
  });

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/google/status', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setStatus(json);
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not fetch Google Calendar status.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar? Future bookings will not generate Google Meet links until an account is reconnected.')) {
      return;
    }
    setActionBusy(true);
    setMessage(null);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/google/disconnect', { method: 'POST' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Google account disconnected successfully.' });
        await fetchStatus();
      } else {
        const json = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: json.error || 'Could not disconnect account.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error while disconnecting.' });
    } finally {
      setActionBusy(false);
    }
  };

  const handleTest = async () => {
    setActionBusy(true);
    setMessage(null);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/google/test', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        setTestResult(json);
        setMessage({ type: 'success', text: 'Test successful! Google Meet link generated and verified.' });
      } else {
        setMessage({ type: 'error', text: json.error || 'Test failed. Please check permissions.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error while running test.' });
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return <div className="settings-card">Checking Google Calendar connection…</div>;
  }

  const isConnected = status?.isConnected;

  return (
    <div className="settings-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <FiVideo color="#002D62" /> Google Meet &amp; Calendar Integration
        </h2>
        <span
          className={`status-chip ${isConnected ? 'ok' : 'muted'}`}
          style={{ padding: '4px 10px', fontSize: '0.82rem', fontWeight: 700 }}
        >
          {isConnected ? 'Connected' : 'Not Connected'}
        </span>
      </div>

      <p className="settings-card-subtitle" style={{ marginBottom: 18, fontSize: '0.88rem', color: '#64748b' }}>
        Sync consultation appointments to your Google Calendar and automatically attach Google Meet video links.
      </p>

      {message && (
        <div
          className={`form-status ${message.type}`}
          style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {message.type === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
          <span>{message.text}</span>
        </div>
      )}

      {isConnected ? (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '22px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 22 }}>
            <div>
              <span style={{ fontSize: '0.76rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                Connected Account
              </span>
              <div style={{ fontSize: '1.02rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                {status.accountEmail}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.76rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                Connected Since
              </span>
              <div style={{ fontSize: '0.92rem', color: '#334155', marginTop: 4 }}>
                {status.connectedAt ? formatDateLabel(status.connectedAt.slice(0, 10)) : 'Active'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.76rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                Status
              </span>
              <div style={{ fontSize: '0.92rem', color: '#16a34a', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiCheckCircle size={15} /> Active &amp; Syncing
              </div>
            </div>
          </div>

          {testResult && testResult.meetLink && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '12px 16px', marginBottom: 18 }}>
              <div style={{ fontWeight: 600, color: '#065f46', fontSize: '0.86rem' }}>
                Test Successful — Sample Meet link:{' '}
                <a href={testResult.meetLink} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: '#047857', textDecoration: 'underline' }}>
                  {testResult.meetLink} <FiExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <button
              type="button"
              className="btn-pro btn-sm btn-light"
              onClick={handleTest}
              disabled={actionBusy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FiRefreshCw className={actionBusy ? 'spin' : ''} />
              {actionBusy ? 'Testing…' : 'Test Meeting'}
            </button>

            <a
              href={connectUrl}
              className="btn-pro btn-sm btn-light"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            >
              <FiRefreshCw /> Switch Account
            </a>

            <button
              type="button"
              className="btn-pro btn-sm btn-outline-danger"
              onClick={handleDisconnect}
              disabled={actionBusy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
            >
              <FiTrash2 /> Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 32, textAlign: 'center' }}>
          <div style={{ maxWidth: 420, margin: '0 auto' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
              <FiVideo size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
              Connect Google Calendar
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 18px 0' }}>
              Sync consultation bookings and automatically create Google Meet links.
            </p>
            <a
              href={connectUrl}
              className="btn-pro btn-orange"
              style={{ padding: '10px 22px', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.92rem', textDecoration: 'none' }}
            >
              <FiVideo /> Connect with Google
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
