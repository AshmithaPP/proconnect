import React from 'react';
import { FiChevronDown } from 'react-icons/fi';

/**
 * Labelled select with a leading icon. When `otherField` is given and "Other"
 * is selected, a free-text input is revealed underneath.
 */
export default function FormSelectField({
  id,
  name,
  label,
  icon,
  value,
  onChange,
  options,
  required = false,
  className,
  otherField,
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {required ? `${label} ` : label}
        {required && <span className="req">*</span>}
      </label>
      <div className="select-wrap">
        <span className="field-icon">{icon}</span>
        <select
          id={id}
          name={name}
          className="form-select-pro"
          value={value}
          onChange={onChange}
          required={required}
          suppressHydrationWarning
        >
          <option value="" disabled>
            Select
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="select-arrow">
          <FiChevronDown />
        </span>
      </div>
      {otherField && value === 'Other' && (
        <div className="other-field-wrap">
          <input
            type="text"
            className="form-control-pro no-icon"
            id={otherField.id}
            name={otherField.name}
            value={otherField.value}
            onChange={onChange}
            placeholder={otherField.placeholder}
            autoFocus
            suppressHydrationWarning
          />
        </div>
      )}
    </div>
  );
}
