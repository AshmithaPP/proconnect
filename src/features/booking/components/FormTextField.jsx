import React from 'react';

/**
 * Labelled text input with a leading icon (booking form styling).
 */
export default function FormTextField({
  id,
  name,
  label,
  icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  readOnly = false,
  badge = null,
  helperText = null,
  inputMode,
  autoComplete,
  maxLength,
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label htmlFor={id} className="field-label" style={{ margin: 0 }}>
          {`${label} `}
          <span className="req">*</span>
        </label>
        {badge}
      </div>
      <div className="input-wrap">
        <span className="field-icon">{icon}</span>
        <input
          type={type}
          className="form-control-pro"
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          required
          readOnly={readOnly}
          suppressHydrationWarning
          style={readOnly ? { background: '#f8fafc', color: '#1e293b', cursor: 'default' } : undefined}
        />
      </div>
      {helperText && (
        <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginTop: 4 }}>
          {helperText}
        </span>
      )}
    </div>
  );
}
