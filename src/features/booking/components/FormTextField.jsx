import React from 'react';

/**
 * Labelled text input with a leading icon (booking form styling).
 */
export default function FormTextField({ id, name, label, icon, type = 'text', value, onChange, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {`${label} `}
        <span className="req">*</span>
      </label>
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
          required
        />
      </div>
    </div>
  );
}
