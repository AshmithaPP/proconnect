'use client';

import React, { useState } from 'react';
import FormField from '@/components/portal/form/FormField';
import FormStatus from '@/components/portal/form/FormStatus';
import useJsonSubmit from '@/components/portal/form/useJsonSubmit';
import { SMTP_SECURITY_OPTIONS } from '@/features/settings/settings.definitions';

/**
 * SMTP settings + "Send test email".
 * The saved password is never sent to the browser: the field stays empty, and leaving it
 * empty keeps the saved one. The test uses what is in the form, so it works before saving.
 *
 * @param {{ initialValue: object, adminEmail: string }} props
 */
export default function SmtpSettingsForm({ initialValue, adminEmail }) {
  const { hasPassword: initialHasPassword, ...initialSettings } = initialValue;
  const [values, setValues] = useState({ ...initialSettings, port: String(initialSettings.port) });
  const [password, setPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [testRecipient, setTestRecipient] = useState(adminEmail);
  const save = useJsonSubmit();
  const test = useJsonSubmit();

  const handleChange = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));
  const settingsPayload = () => ({ ...values, port: Number(values.port) });

  const handleSave = async (e) => {
    e.preventDefault();
    const { ok, data } = await save.submit('/api/admin/settings/smtp', 'PUT', { ...settingsPayload(), password }, 'SMTP settings saved');
    if (ok) {
      const { hasPassword: savedHasPassword, ...saved } = data.value;
      setValues({ ...saved, port: String(saved.port) });
      setHasPassword(savedHasPassword);
      setPassword('');
    }
  };

  const handleClearPassword = async () => {
    const { ok, data } = await save.submit('/api/admin/settings/smtp', 'PUT', { ...settingsPayload(), clearPassword: true }, 'Saved password removed');
    if (ok) setHasPassword(data.value.hasPassword);
  };

  const handleTest = () =>
    test.submit('/api/admin/smtp-test', 'POST', { settings: settingsPayload(), password, to: testRecipient });

  const errors = { ...test.fieldErrors, ...save.fieldErrors };
  const busy = save.isSubmitting || test.isSubmitting;

  return (
    <form className="settings-card" onSubmit={handleSave} noValidate>
      <h2 className="settings-card-title">SMTP (outgoing email)</h2>
      <p className="settings-card-subtitle">
        Used for booking confirmations and notifications. The password is stored encrypted and never shown again.
      </p>

      <div className="settings-grid">
        <FormField
          name="isEnabled"
          type="checkbox"
          label="Send emails"
          hint="While off, emails are not sent (they are logged as skipped)."
          value={values.isEnabled}
          onChange={handleChange}
          wide
          disabled={busy}
        />
        <FormField name="host" label="SMTP host" placeholder="smtp.gmail.com" value={values.host} onChange={handleChange} error={errors.host} disabled={busy} />
        <FormField name="port" type="number" label="Port" value={values.port} onChange={handleChange} error={errors.port} disabled={busy} />
        <FormField
          name="security"
          type="select"
          label="Security"
          options={SMTP_SECURITY_OPTIONS}
          value={values.security}
          onChange={handleChange}
          disabled={busy}
        />
        <FormField
          name="username"
          label="Username"
          autoComplete="off"
          value={values.username}
          onChange={handleChange}
          error={errors.username}
          disabled={busy}
        />
        <FormField
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          placeholder={hasPassword ? '•••••••• (saved — leave empty to keep)' : ''}
          hint={hasPassword ? 'A password is saved. Type a new one only to replace it.' : 'For Gmail, use an App Password.'}
          value={password}
          onChange={(_, value) => setPassword(value)}
          error={errors.password}
          disabled={busy}
        />
        <div className="settings-field" style={{ alignSelf: 'end' }}>
          {hasPassword && (
            <button type="button" className="link-button danger" onClick={handleClearPassword} disabled={busy}>
              Remove saved password
            </button>
          )}
        </div>
        <FormField name="fromName" label="From name" value={values.fromName} onChange={handleChange} disabled={busy} />
        <FormField
          name="fromEmail"
          type="email"
          label="From email"
          placeholder="bookings@yourdomain.com"
          value={values.fromEmail}
          onChange={handleChange}
          error={errors.fromEmail}
          disabled={busy}
        />
        <FormField
          name="replyToEmail"
          type="email"
          label="Reply-to email"
          hint="Optional. Where customer replies go."
          value={values.replyToEmail}
          onChange={handleChange}
          error={errors.replyToEmail}
          disabled={busy}
        />
      </div>

      <div className="settings-actions">
        <button type="submit" className="btn-pro btn-orange btn-sm" disabled={busy} suppressHydrationWarning>
          {save.isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
        <FormStatus status={save.status} />
      </div>

      <div className="inline-form">
        <div className="settings-grid">
          <FormField
            name="testRecipient"
            type="email"
            label="Send a test email to"
            value={testRecipient}
            onChange={(_, value) => setTestRecipient(value)}
            error={errors.testRecipient}
            hint="Uses the settings in this form — you can test before saving."
            disabled={busy}
          />
          <div className="settings-field" style={{ alignSelf: 'center' }}>
            <button type="button" className="btn-pro btn-dark btn-sm" onClick={handleTest} disabled={busy} suppressHydrationWarning>
              {test.isSubmitting ? 'Sending…' : 'Send test email'}
            </button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <FormStatus status={test.status} />
        </div>
      </div>
    </form>
  );
}
