'use client';

import React, { useState } from 'react';
import FormField from '@/components/portal/form/FormField';
import FormStatus from '@/components/portal/form/FormStatus';
import useJsonSubmit from '@/components/portal/form/useJsonSubmit';
import { SETTINGS_FORMS } from '@/features/settings/settings.fields';

/**
 * General / SEO settings form. Saves to PUT /api/admin/settings/{settingKey}.
 * @param {{ settingKey: 'general' | 'seo', initialValue: object }} props
 */
export default function SettingsForm({ settingKey, initialValue }) {
  const form = SETTINGS_FORMS[settingKey];
  const [values, setValues] = useState(initialValue);
  const { submit, isSubmitting, status, fieldErrors } = useJsonSubmit();

  const handleChange = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { ok, data } = await submit(`/api/admin/settings/${settingKey}`, 'PUT', values, `${form.title} settings saved`);
    if (ok) setValues(data.value);
  };

  return (
    <form className="settings-card" onSubmit={handleSubmit} noValidate>
      <h2 className="settings-card-title">{form.title}</h2>
      <p className="settings-card-subtitle">{form.subtitle}</p>

      <div className="settings-grid">
        {form.fields.map((field) => (
          <FormField
            key={field.name}
            {...field}
            value={values[field.name]}
            onChange={handleChange}
            error={fieldErrors[field.name]}
            disabled={isSubmitting}
          />
        ))}
      </div>

      <div className="settings-actions">
        <button type="submit" className="btn-pro btn-orange btn-sm" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
        <FormStatus status={status} />
      </div>
    </form>
  );
}
