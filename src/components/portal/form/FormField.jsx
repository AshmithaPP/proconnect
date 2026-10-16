'use client';

import React from 'react';

/**
 * One labelled form control for portal pages: text-like inputs, textarea, select, checkbox.
 *
 * @param {{
 *   name: string, label: string, value: any, onChange: (name: string, value: any) => void,
 *   type?: 'text'|'email'|'url'|'number'|'password'|'textarea'|'select'|'checkbox',
 *   error?: string, hint?: string, required?: boolean, placeholder?: string,
 *   options?: Array<{ value: string, label: string }>, wide?: boolean, code?: boolean,
 *   autoComplete?: string, disabled?: boolean
 * }} props
 */
export default function FormField({
  name,
  label,
  value,
  onChange,
  type = 'text',
  error,
  hint,
  required,
  placeholder,
  options = [],
  wide,
  code,
  autoComplete,
  disabled,
}) {
  const id = `field-${name}`;
  const controlClass = `form-control-pro no-icon${error ? ' has-error' : ''}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  if (type === 'checkbox') {
    return (
      <div className={`settings-field${wide ? ' span-2' : ''}`}>
        <label className="settings-check" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(name, e.target.checked)}
            disabled={disabled}
            suppressHydrationWarning
          />
          <span>{label}</span>
        </label>
        {hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}
        {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
      </div>
    );
  }

  let control;
  if (type === 'textarea') {
    control = (
      <textarea
        id={id}
        className={`${controlClass} settings-textarea${code ? ' code' : ''}`}
        value={value ?? ''}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        disabled={disabled}
        spellCheck={!code}
        suppressHydrationWarning
      />
    );
  } else if (type === 'select') {
    control = (
      <select
        id={id}
        className={`form-select-pro${error ? ' has-error' : ''}`}
        value={value ?? ''}
        onChange={(e) => onChange(name, e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        disabled={disabled}
        style={{ paddingLeft: 16 }}
        suppressHydrationWarning
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        id={id}
        type={type}
        className={controlClass}
        value={value ?? ''}
        onChange={(e) => onChange(name, type === 'number' ? e.target.value.replace(/[^\d]/g, '') : e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        disabled={disabled}
        inputMode={type === 'number' ? 'numeric' : undefined}
        suppressHydrationWarning
      />
    );
  }

  return (
    <div className={`settings-field${wide ? ' span-2' : ''}`}>
      <label htmlFor={id} className="field-label">
        {label} {required && <span className="req">*</span>}
      </label>
      {control}
      {error ? (
        <span className="field-error" id={`${id}-error`}>{error}</span>
      ) : (
        hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>
      )}
    </div>
  );
}
