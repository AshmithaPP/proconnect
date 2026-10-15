'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import FormField from '@/components/portal/form/FormField';
import FormStatus from '@/components/portal/form/FormStatus';
import useJsonSubmit from '@/components/portal/form/useJsonSubmit';
import { MIN_PASSWORD_CHARS } from '@/features/auth/account.schema';

function formatDateTime(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

/**
 * The single consultant account: edit name/email, reset password — or create it if missing.
 * @param {{ consultant: { fullName: string, email: string, lastLoginAt: Date|null } | null }} props
 */
export default function ConsultantAccount({ consultant }) {
  const router = useRouter();
  const details = useJsonSubmit();
  const password = useJsonSubmit();
  const [values, setValues] = useState({ fullName: consultant?.fullName || '', email: consultant?.email || '', password: '' });
  const [newPassword, setNewPassword] = useState('');

  const setValue = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const saveDetails = async (e) => {
    e.preventDefault();
    const { ok } = consultant
      ? await details.submit('/api/admin/consultant', 'PUT', { fullName: values.fullName, email: values.email }, 'Saved')
      : await details.submit('/api/admin/consultant', 'POST', values, 'Consultant account created');
    if (ok) {
      setValue('password', '');
      router.refresh();
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    const { ok } = await password.submit('/api/admin/consultant/password', 'PUT', { password: newPassword }, 'Password changed — the consultant has been signed out and must sign in with the new password');
    if (ok) setNewPassword('');
  };

  return (
    <>
      <form className="settings-card" onSubmit={saveDetails} noValidate>
        <h2 className="settings-card-title">{consultant ? 'Sign-in details' : 'Create the consultant account'}</h2>
        <p className="settings-card-subtitle">
          {consultant
            ? `The consultant signs in at /consultant/login. Last sign-in: ${formatDateTime(consultant.lastLoginAt)}.`
            : 'There is no consultant account yet. Create it so the consultant can sign in at /consultant/login.'}
        </p>
        <div className="settings-grid">
          <FormField name="fullName" label="Name" required value={values.fullName} onChange={setValue} error={details.fieldErrors.fullName} disabled={details.isSubmitting} />
          <FormField
            name="email"
            type="email"
            label="Email (used to sign in)"
            required
            autoComplete="off"
            value={values.email}
            onChange={setValue}
            error={details.fieldErrors.email}
            disabled={details.isSubmitting}
          />
          {!consultant && (
            <FormField
              name="password"
              type="password"
              label="Password"
              required
              autoComplete="new-password"
              hint={`At least ${MIN_PASSWORD_CHARS} characters.`}
              value={values.password}
              onChange={setValue}
              error={details.fieldErrors.password}
              disabled={details.isSubmitting}
            />
          )}
        </div>
        <div className="settings-actions">
          <button type="submit" className="btn-pro btn-orange btn-sm" disabled={details.isSubmitting}>
            {details.isSubmitting ? 'Saving…' : consultant ? 'Save' : 'Create account'}
          </button>
          <FormStatus status={details.status} />
        </div>
      </form>

      {consultant && (
        <form className="settings-card" onSubmit={resetPassword} noValidate>
          <h2 className="settings-card-title">Reset password</h2>
          <p className="settings-card-subtitle">Set a new password for the consultant. They are signed out everywhere and use the new one next time.</p>
          <div className="settings-grid">
            <FormField
              name="newPassword"
              type="password"
              label="New password"
              autoComplete="new-password"
              hint={`At least ${MIN_PASSWORD_CHARS} characters. Share it with the consultant securely.`}
              value={newPassword}
              onChange={(_, value) => setNewPassword(value)}
              error={password.fieldErrors.password}
              disabled={password.isSubmitting}
            />
          </div>
          <div className="settings-actions">
            <button type="submit" className="btn-pro btn-dark btn-sm" disabled={password.isSubmitting}>
              {password.isSubmitting ? 'Saving…' : 'Set new password'}
            </button>
            <FormStatus status={password.status} />
          </div>
        </form>
      )}
    </>
  );
}
