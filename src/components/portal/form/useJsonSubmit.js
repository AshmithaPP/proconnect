'use client';

import { useState, useCallback } from 'react';

/**
 * Sends JSON to a portal API and tracks the result for the form:
 * { isSubmitting, status: { type: 'success'|'error', message } | null, fieldErrors }.
 */
export default function useJsonSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  /**
   * @param {string} url
   * @param {'POST'|'PUT'|'PATCH'|'DELETE'} method
   * @param {object} [body]
   * @param {string} [successMessage]
   * @returns {Promise<{ ok: boolean, data: any }>}
   */
  const submit = useCallback(async (url, method, body, successMessage = 'Saved') => {
    setIsSubmitting(true);
    setStatus(null);
    setFieldErrors({});
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setStatus({ type: 'error', message: 'Your session has expired. Please sign in again.' });
        return { ok: false, data };
      }
      if (!res.ok) {
        setFieldErrors(data.fieldErrors || {});
        setStatus({ type: 'error', message: data.error || 'Something went wrong' });
        return { ok: false, data };
      }
      setStatus({ type: 'success', message: data.message || successMessage });
      return { ok: true, data };
    } catch {
      setStatus({ type: 'error', message: 'Network error. Please try again.' });
      return { ok: false, data: null };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submit, isSubmitting, status, setStatus, fieldErrors, setFieldErrors };
}
