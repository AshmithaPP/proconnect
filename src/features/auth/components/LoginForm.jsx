'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MailIcon, LockIcon } from '@/components/ui/Icons';

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setErrorMessage(
            data.error || 'Too many failed login attempts. Please wait before trying again.'
          );
        } else {
          setErrorMessage(data.error || 'Invalid email or password.');
        }
        setIsLoading(false);
        return;
      }

      // Login successful: perform clean client navigation to dashboard
      router.push('/admin/dashboard');
      router.refresh();
    } catch {
      setErrorMessage('Network connection error. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-card">
      <div className="admin-login-head">
        <div className="admin-badge">Admin Authentication</div>
        <h2>Sign In to ProConnect</h2>
        <p>Enter your administrator credentials to access the management portal.</p>
      </div>

      {errorMessage && (
        <div className="form-alert" style={{ marginBottom: '20px' }}>
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Email Field */}
        <div style={{ marginBottom: '18px' }}>
          <label htmlFor="adminEmail" className="field-label">
            Email Address <span className="req">*</span>
          </label>
          <div className="input-wrap">
            <span className="field-icon">
              <MailIcon />
            </span>
            <input
              type="email"
              id="adminEmail"
              className="form-control-pro"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@preconnect.com"
              autoComplete="username"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Password Field */}
        <div style={{ marginBottom: '24px' }}>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label htmlFor="adminPassword" className="field-label" style={{ marginBottom: 0 }}>
              Password <span className="req">*</span>
            </label>
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="input-wrap">
            <span className="field-icon">
              <LockIcon />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              id="adminPassword"
              className="form-control-pro"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn-pro btn-orange w-100 justify-content-center"
          disabled={isLoading}
          style={{ opacity: isLoading ? 0.75 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          {isLoading ? (
            <span className="d-flex align-items-center gap-2">
              <span className="dot" style={{ background: '#fff' }} /> Verifying...
            </span>
          ) : (
            'Sign In to Dashboard'
          )}
        </button>
      </form>
    </div>
  );
}
