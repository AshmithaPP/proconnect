'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import FormField from '@/components/portal/form/FormField';
import FormStatus from '@/components/portal/form/FormStatus';
import useJsonSubmit from '@/components/portal/form/useJsonSubmit';
import { MIN_PASSWORD_CHARS } from '@/features/auth/account.schema';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

const EMPTY_ACCOUNT = { fullName: '', email: '', password: '' };

/**
 * Create consultant accounts, edit name/email, reset password, activate/deactivate.
 * @param {{ consultants: object[] }} props
 */
export default function ConsultantsManager({ consultants }) {
  const router = useRouter();
  const create = useJsonSubmit();
  const rowAction = useJsonSubmit();
  const [newAccount, setNewAccount] = useState(EMPTY_ACCOUNT);
  const [editing, setEditing] = useState(null); // { portalUserId, mode: 'edit'|'password', fullName, email, password }

  const handleCreate = async (e) => {
    e.preventDefault();
    const { ok } = await create.submit('/api/admin/consultants', 'POST', newAccount, 'Consultant account created');
    if (ok) {
      setNewAccount(EMPTY_ACCOUNT);
      router.refresh();
    }
  };

  const toggleStatus = async (consultant) => {
    const deactivate = consultant.accountStatus === 'active';
    if (deactivate && !window.confirm(`Deactivate ${consultant.fullName}? They will be signed out immediately.`)) return;
    const { ok } = await rowAction.submit(
      `/api/admin/consultants/${consultant.portalUserId}`,
      'PATCH',
      { accountStatus: deactivate ? 'inactive' : 'active' },
      deactivate ? `${consultant.fullName} deactivated` : `${consultant.fullName} activated`
    );
    if (ok) router.refresh();
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const { portalUserId, mode, fullName, email, password } = editing;
    const { ok } =
      mode === 'edit'
        ? await rowAction.submit(`/api/admin/consultants/${portalUserId}`, 'PATCH', { fullName, email }, 'Consultant updated')
        : await rowAction.submit(
            `/api/admin/consultants/${portalUserId}/password`,
            'PUT',
            { password },
            'Password reset — the consultant has been signed out everywhere'
          );
    if (ok) {
      setEditing(null);
      router.refresh();
    }
  };

  return (
    <>
      <div className="admin-table-card">
        <div className="admin-table-head">
          <h2 className="admin-table-title">Consultant Accounts</h2>
          <span className="card-pill-tag">{consultants.length} total</span>
        </div>

        {rowAction.status && !editing && (
          <div style={{ padding: '12px 24px 0' }}>
            <FormStatus status={rowAction.status} />
          </div>
        )}

        {consultants.length === 0 ? (
          <div className="admin-table-empty">No consultant account yet — create one below.</div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {consultants.map((consultant) => {
                  const isEditing = editing?.portalUserId === consultant.portalUserId;
                  return (
                    <React.Fragment key={consultant.portalUserId}>
                      <tr>
                        <td className="cell-primary">{consultant.fullName}</td>
                        <td>{consultant.email}</td>
                        <td>
                          <span className={`status-chip ${consultant.accountStatus === 'active' ? 'ok' : 'muted'}`}>
                            {consultant.accountStatus === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="cell-nowrap">{formatDateTime(consultant.createdAt)}</td>
                        <td className="cell-nowrap">{formatDateTime(consultant.lastLoginAt)}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => setEditing({ portalUserId: consultant.portalUserId, mode: 'edit', fullName: consultant.fullName, email: consultant.email })}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => setEditing({ portalUserId: consultant.portalUserId, mode: 'password', password: '' })}
                            >
                              Reset password
                            </button>
                            <button
                              type="button"
                              className={`link-button${consultant.accountStatus === 'active' ? ' danger' : ''}`}
                              onClick={() => toggleStatus(consultant)}
                              disabled={rowAction.isSubmitting}
                            >
                              {consultant.accountStatus === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isEditing && (
                        <tr>
                          <td colSpan={6}>
                            <form className="inline-form" onSubmit={saveEdit} noValidate>
                              <div className="settings-grid">
                                {editing.mode === 'edit' ? (
                                  <>
                                    <FormField
                                      name="fullName"
                                      label="Name"
                                      value={editing.fullName}
                                      onChange={(name, value) => setEditing((prev) => ({ ...prev, [name]: value }))}
                                      error={rowAction.fieldErrors.fullName}
                                    />
                                    <FormField
                                      name="email"
                                      type="email"
                                      label="Email (used to sign in)"
                                      value={editing.email}
                                      onChange={(name, value) => setEditing((prev) => ({ ...prev, [name]: value }))}
                                      error={rowAction.fieldErrors.email}
                                    />
                                  </>
                                ) : (
                                  <FormField
                                    name="password"
                                    type="password"
                                    label="New password"
                                    autoComplete="new-password"
                                    hint={`At least ${MIN_PASSWORD_CHARS} characters. Share it with the consultant securely.`}
                                    value={editing.password}
                                    onChange={(name, value) => setEditing((prev) => ({ ...prev, [name]: value }))}
                                    error={rowAction.fieldErrors.password}
                                  />
                                )}
                              </div>
                              <div className="settings-actions" style={{ marginTop: 14 }}>
                                <button type="submit" className="btn-pro btn-orange btn-sm" disabled={rowAction.isSubmitting}>
                                  {editing.mode === 'edit' ? 'Save' : 'Set new password'}
                                </button>
                                <button type="button" className="btn-pro btn-light btn-sm" onClick={() => setEditing(null)}>
                                  Cancel
                                </button>
                                <FormStatus status={rowAction.status} />
                              </div>
                            </form>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form className="settings-card" onSubmit={handleCreate} noValidate>
        <h2 className="settings-card-title">Add a consultant</h2>
        <p className="settings-card-subtitle">They sign in at /consultant/login. Emails must be unique across both portals.</p>
        <div className="settings-grid">
          <FormField
            name="fullName"
            label="Full name"
            required
            value={newAccount.fullName}
            onChange={(name, value) => setNewAccount((prev) => ({ ...prev, [name]: value }))}
            error={create.fieldErrors.fullName}
            disabled={create.isSubmitting}
          />
          <FormField
            name="email"
            type="email"
            label="Email"
            required
            autoComplete="off"
            value={newAccount.email}
            onChange={(name, value) => setNewAccount((prev) => ({ ...prev, [name]: value }))}
            error={create.fieldErrors.email}
            disabled={create.isSubmitting}
          />
          <FormField
            name="password"
            type="password"
            label="Initial password"
            required
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD_CHARS} characters.`}
            value={newAccount.password}
            onChange={(name, value) => setNewAccount((prev) => ({ ...prev, [name]: value }))}
            error={create.fieldErrors.password}
            disabled={create.isSubmitting}
          />
        </div>
        <div className="settings-actions">
          <button type="submit" className="btn-pro btn-orange btn-sm" disabled={create.isSubmitting}>
            {create.isSubmitting ? 'Creating…' : 'Create consultant'}
          </button>
          <FormStatus status={create.status} />
        </div>
      </form>
    </>
  );
}
