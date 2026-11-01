'use client';

import { useCallback, useId, useState, type ChangeEvent, type ReactNode } from 'react';
import { ApiRequestError, api, errorMessage } from '@/lib/client';

// Shared form pieces. Fields show the server's message for that field; the server is the only authority on validity.

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}

interface BaseProps {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal' | 'search' | 'url';
}

export function TextField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  required,
  autoComplete,
  disabled,
  placeholder,
  maxLength,
  inputMode,
  type = 'text',
  pattern,
  min,
  max,
  autoFocus,
}: BaseProps & { type?: 'text' | 'email' | 'tel' | 'date' | 'number'; pattern?: string; min?: string; max?: string; autoFocus?: boolean }) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? '' : ' (optional)'}
      </label>
      <input
        id={id}
        className="input"
        name={name}
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        pattern={pattern}
        min={min}
        max={max}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? errId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined}
        autoCapitalize={type === 'email' ? 'none' : undefined}
        spellCheck={type === 'email' ? false : undefined}
      />
      {hint && !error ? (
        <p id={hintId} className="hint">
          {hint}
        </p>
      ) : null}
      <FieldError id={errId} message={error} />
    </div>
  );
}

export function PasswordField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  autoComplete = 'current-password',
  required = true,
}: Omit<BaseProps, 'inputMode' | 'placeholder' | 'maxLength' | 'disabled'>) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw">
        <input
          id={id}
          className="input"
          name={name}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          maxLength={128}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined}
          autoCapitalize="none"
          spellCheck={false}
        />
        <button type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-controls={id}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && !error ? (
        <p id={hintId} className="hint">
          {hint}
        </p>
      ) : null}
      <FieldError id={errId} message={error} />
    </div>
  );
}

export function SelectField({
  label,
  name,
  value,
  onChange,
  error,
  required,
  options,
  placeholder,
  autoComplete,
}: Omit<BaseProps, 'hint' | 'inputMode' | 'maxLength' | 'disabled'> & { options: readonly string[] | readonly { value: string; label: string }[] }) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? '' : ' (optional)'}
      </label>
      <select
        id={id}
        className="select"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
      >
        <option value="">{placeholder ?? 'Select'}</option>
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
      <FieldError id={errId} message={error} />
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  required,
  maxLength,
  rows = 5,
}: Omit<BaseProps, 'inputMode' | 'autoComplete' | 'placeholder' | 'disabled'> & { rows?: number }) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? '' : ' (optional)'}
      </label>
      <textarea
        id={id}
        className="textarea"
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
      />
      {hint && !error ? <p className="hint">{hint}</p> : null}
      <FieldError id={errId} message={error} />
    </div>
  );
}

export function CheckField({
  name,
  checked,
  onChange,
  error,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className="field">
      <label className="check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
        />
        <span>{children}</span>
      </label>
      <FieldError id={errId} message={error} />
    </div>
  );
}

export function SubmitButton({ busy, children, variant = 'primary', block = true }: { busy: boolean; children: ReactNode; variant?: 'primary' | 'plain'; block?: boolean }) {
  return (
    <button type="submit" className={`btn ${variant === 'primary' ? 'btn--primary' : ''} ${block ? 'btn--block' : ''}`} aria-busy={busy} disabled={busy}>
      {children}
    </button>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'ok' | 'warn' | 'error' | 'info'; children: ReactNode }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/**
 * Holds values, field errors and the busy flag for one form.
 *   const f = useApiForm({ email: '', password: '' });
 *   <form onSubmit={f.submit('/api/auth/login', (r) => router.push('/'))}>
 */
export function useApiForm<T extends Record<string, string | boolean>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = useCallback(
    <K extends keyof T>(key: K) =>
      (value: T[K]) => {
        setValues((v) => ({ ...v, [key]: value }));
        setErrors((e) => {
          if (!e[key as string]) return e;
          const { [key as string]: _drop, ...rest } = e;
          return rest;
        });
      },
    [],
  );

  const submit = useCallback(
    (url: string, onDone: (result: any) => void | Promise<void>, extra?: () => Record<string, unknown> | Promise<Record<string, unknown>>, method: 'POST' | 'PATCH' | 'PUT' = 'POST') =>
      async (e?: { preventDefault: () => void }) => {
        e?.preventDefault();
        if (busy) return;
        setBusy(true);
        setFormError(null);
        setErrors({});
        try {
          const more = extra ? await extra() : {};
          const result = await api(url, { method, body: { ...values, ...more } });
          await onDone(result);
        } catch (err) {
          if (err instanceof ApiRequestError && Object.keys(err.fields).length) {
            setErrors(err.fields);
            // Messages that belong to no visible field are shown at the top of the form.
            setFormError(err.fields[''] ?? (Object.keys(err.fields).every((k) => k in (values as object)) ? null : err.message));
          } else {
            setFormError(errorMessage(err));
          }
        } finally {
          setBusy(false);
        }
      },
    [busy, values],
  );

  return { values, set, errors, setErrors, formError, setFormError, busy, setBusy, submit, setValues };
}
