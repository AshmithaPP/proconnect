'use client';

import React, { useMemo, useRef, useState } from 'react';
import FormField from '@/components/portal/form/FormField';
import FormStatus from '@/components/portal/form/FormStatus';
import useJsonSubmit from '@/components/portal/form/useJsonSubmit';
import { SAMPLE_VARIABLES, renderTemplateText, wrapEmailLayout } from '@/features/email/email-templates';

/**
 * Edit email templates with a live preview (sample data, same renderer as real emails).
 * @param {{ initialTemplates: object[], siteVariables: Record<string, string> }} props
 */
export default function EmailTemplatesEditor({ initialTemplates, siteVariables }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedKey, setSelectedKey] = useState(initialTemplates[0]?.templateKey);
  const selected = templates.find((t) => t.templateKey === selectedKey);
  const [draft, setDraft] = useState(() => toDraft(initialTemplates[0]));
  const { submit, isSubmitting, status, setStatus, fieldErrors } = useJsonSubmit();
  const bodyRef = useRef(null);

  function toDraft(template) {
    return template ? { emailSubject: template.emailSubject, bodyHtml: template.bodyHtml, isEnabled: template.isEnabled } : null;
  }

  const selectTemplate = (templateKey) => {
    setSelectedKey(templateKey);
    setDraft(toDraft(templates.find((t) => t.templateKey === templateKey)));
    setStatus(null);
  };

  const replaceTemplate = (updated) => {
    setTemplates((prev) => prev.map((t) => (t.templateKey === updated.templateKey ? updated : t)));
    setDraft(toDraft(updated));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const { ok, data } = await submit(`/api/admin/email-templates/${selectedKey}`, 'PUT', draft, 'Template saved');
    if (ok) replaceTemplate(data.template);
  };

  const handleReset = async () => {
    if (!window.confirm('Reset this template to the default wording? Your changes will be lost.')) return;
    const { ok, data } = await submit(`/api/admin/email-templates/${selectedKey}`, 'DELETE', undefined, 'Reset to default');
    if (ok) replaceTemplate(data.template);
  };

  /** Insert {{variable}} at the cursor in the body */
  const insertVariable = (name) => {
    const token = `{{${name}}}`;
    const textarea = bodyRef.current?.querySelector('textarea');
    if (!textarea) return;
    const { selectionStart = draft.bodyHtml.length, selectionEnd = draft.bodyHtml.length } = textarea;
    const bodyHtml = draft.bodyHtml.slice(0, selectionStart) + token + draft.bodyHtml.slice(selectionEnd);
    setDraft((prev) => ({ ...prev, bodyHtml }));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = selectionStart + token.length;
    });
  };

  const preview = useMemo(() => {
    if (!draft) return { subject: '', html: '' };
    const variables = { ...SAMPLE_VARIABLES, ...Object.fromEntries(Object.entries(siteVariables).filter(([, v]) => v)) };
    return {
      subject: renderTemplateText(draft.emailSubject, variables, { html: false }),
      html: wrapEmailLayout(renderTemplateText(draft.bodyHtml, variables, { html: true }), variables),
    };
  }, [draft, siteVariables]);

  if (!selected || !draft) return null;

  return (
    <div className="template-layout">
      <div className="template-list" role="tablist" aria-label="Email templates">
        {templates.map((template) => (
          <button
            key={template.templateKey}
            type="button"
            role="tab"
            aria-selected={template.templateKey === selectedKey}
            className={`template-list-item${template.templateKey === selectedKey ? ' active' : ''}`}
            onClick={() => selectTemplate(template.templateKey)}
          >
            <span className="template-list-name">{template.templateName}</span>
            <span className="template-list-meta">
              To: {template.recipientLabel} · {template.isCustomized ? 'Customised' : 'Default'}
              {!template.isEnabled && ' · Disabled'}
            </span>
          </button>
        ))}
      </div>

      <div className="admin-dashboard-full" style={{ gap: 20 }}>
        <form className="settings-card" onSubmit={handleSave} noValidate>
          <h2 className="settings-card-title">{selected.templateName}</h2>
          <p className="settings-card-subtitle">{selected.description}</p>

          <div className="settings-grid">
            <FormField
              name="isEnabled"
              type="checkbox"
              label="Send this email"
              value={draft.isEnabled}
              onChange={(name, value) => setDraft((prev) => ({ ...prev, [name]: value }))}
              wide
              disabled={isSubmitting}
            />
            <FormField
              name="emailSubject"
              label="Subject"
              required
              wide
              value={draft.emailSubject}
              onChange={(name, value) => setDraft((prev) => ({ ...prev, [name]: value }))}
              error={fieldErrors.emailSubject}
              disabled={isSubmitting}
            />
            <div className="settings-field span-2">
              <span className="field-label">Placeholders (click to insert into the body)</span>
              <div className="variable-chips">
                {selected.variables.map((name) => (
                  <button key={name} type="button" className="variable-chip" onClick={() => insertVariable(name)}>
                    {`{{${name}}}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-field span-2" ref={bodyRef}>
              <FormField
                name="bodyHtml"
                type="textarea"
                code
                label="Body (HTML)"
                required
                value={draft.bodyHtml}
                onChange={(name, value) => setDraft((prev) => ({ ...prev, [name]: value }))}
                error={fieldErrors.bodyHtml}
                hint="Placeholder values are escaped automatically. The header and contact footer are added for you."
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="settings-actions">
            <button type="submit" className="btn-pro btn-orange btn-sm" disabled={isSubmitting} suppressHydrationWarning>
              {isSubmitting ? 'Saving…' : 'Save template'}
            </button>
            {selected.isCustomized && (
              <button type="button" className="btn-pro btn-light btn-sm" onClick={handleReset} disabled={isSubmitting} suppressHydrationWarning>
                Reset to default
              </button>
            )}
            <FormStatus status={status} />
          </div>
        </form>

        <div className="settings-card">
          <h2 className="settings-card-title">Preview</h2>
          <p className="settings-card-subtitle">With sample data. Updates as you type.</p>
          <p className="preview-subject">
            <strong>Subject:</strong> {preview.subject}
          </p>
          <iframe
            title="Email preview"
            className="template-preview-frame"
            sandbox=""
            srcDoc={preview.html}
          />
        </div>
      </div>
    </div>
  );
}
