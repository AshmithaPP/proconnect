'use client';

import React, { useState } from 'react';
import FormField from '@/components/portal/form/FormField';
import FormStatus from '@/components/portal/form/FormStatus';
import useJsonSubmit from '@/components/portal/form/useJsonSubmit';
import { MIN_PASSWORD_CHARS } from '@/features/auth/account.schema';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

/**
 * Change your own password (both portals). Other devices are signed out; this one stays.
 * @param {{ portalKey: 'admin' | 'consultant' }} props
 */
export default function ChangePasswordForm({ portalKey }) {
  const [values, setValues] = useState(EMPTY);
  const [confirmError, setConfirmError] = useState('');
  const { submit, isSubmitting, status, fieldErrors } = useJsonSubmit();

  const handleChange = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setConfirmError('');
    if (values.newPassword !== values.confirmPassword) {
      setConfirmError('Passwords do not match');
      return;
    }
    const { ok } = await submit(
      `/api/auth/${portalKey}/password`,
      'PUT',
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      'Password changed. You have been signed out on other devices.'
    );
    if (ok) setValues(EMPTY);
  };

  return (
    <form className="settings-card" onSubmit={handleSubmit} noValidate>
      <h2 className="settings-card-title">Change password</h2>
      <p className="settings-card-subtitle">You stay signed in here; other devices are signed out.</p>
      <div className="settings-grid">
        <FormField
          name="currentPassword"
          type="password"
          label="Current password"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={handleChange}
          error={fieldErrors.currentPassword}
          wide
          disabled={isSubmitting}
        />
        <FormField
          name="newPassword"
          type="password"
          label="New password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_CHARS} characters.`}
          value={values.newPassword}
          onChange={handleChange}
          error={fieldErrors.newPassword}
          disabled={isSubmitting}
        />
        <FormField
          name="confirmPassword"
          type="password"
          label="Confirm new password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={handleChange}
          error={confirmError}
          disabled={isSubmitting}
        />
      </div>
      <div className="settings-actions">
        <button type="submit" className="btn-pro btn-orange btn-sm" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Change password'}
        </button>
        <FormStatus status={status} />
      </div>
    </form>
  );
}
