"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// The right control for a field's kind of value. It keeps what is being typed
// to itself and hands back a finished value: on leaving the box or pressing
// Enter for typed values, at once for choices. `live` hands back every keystroke.
export function FieldControl({ field, value, onCommit, onCancel, autoFocus = false, compact = false, live = false, label, id }) {
  const [draft, setDraft] = useState(toDraft(field, value));
  const cancelled = useRef(false);

  useEffect(() => {
    setDraft(toDraft(field, value));
  }, [field.key, value]); // eslint-disable-line react-hooks/exhaustive-deps

  const className = `${field.type === "choice" || field.type === "yesno" ? "cw-select" : "cw-input"} ${compact ? "desk-control-compact" : ""}`;
  const shared = { id, className, autoFocus, "aria-label": label };

  if (field.type === "choice") {
    return (
      <select {...shared} value={draft} onChange={(event) => { setDraft(event.target.value); onCommit(event.target.value); }} onBlur={() => onCancel?.()} onKeyDown={(event) => { if (event.key === "Escape") onCancel?.(); }}>
        {/* A stored value that is no longer one of the choices is still shown. */}
        {draft && !(field.options || []).some(([option]) => option === draft) ? <option value={draft}>{draft}</option> : null}
        {(field.options || []).map(([option, text]) => <option value={option} key={option}>{text}</option>)}
      </select>
    );
  }
  if (field.type === "yesno") {
    return (
      <select {...shared} value={draft} onChange={(event) => { setDraft(event.target.value); onCommit(fromDraft(field, event.target.value)); }} onBlur={() => onCancel?.()} onKeyDown={(event) => { if (event.key === "Escape") onCancel?.(); }}>
        <option value="">Not set</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  const typed = {
    ...shared,
    value: draft,
    onChange: (event) => {
      setDraft(event.target.value);
      if (live) onCommit(fromDraft(field, event.target.value));
    },
    onBlur: () => {
      if (cancelled.current) {
        cancelled.current = false;
        return;
      }
      if (!live) onCommit(fromDraft(field, draft));
    },
    onKeyDown: (event) => {
      if (event.key === "Enter" && field.type !== "longtext") event.currentTarget.blur();
      if (event.key === "Escape") {
        cancelled.current = true;
        setDraft(toDraft(field, value));
        if (onCancel) onCancel();
        else event.currentTarget.blur();
      }
    }
  };
  if (field.type === "longtext") return <textarea {...typed} rows={8} />;
  if (field.type === "date") return <input {...typed} type="date" />;
  if (field.type === "number") return <input {...typed} inputMode="decimal" />;
  return <input {...typed} maxLength={field.key === "title" ? 160 : 500} />;
}

function toDraft(field, value) {
  if (field.type === "yesno") return value === true ? "yes" : value === false ? "no" : "";
  // A built-in figure of 0 means "not given", so the box is left empty.
  if (field.type === "number") return value || (value === 0 && field.customId) ? String(value) : "";
  return value == null ? "" : String(value);
}

function fromDraft(field, draft) {
  if (field.type === "yesno") return draft === "yes" ? true : draft === "no" ? false : null;
  if (field.type === "number") {
    const number = Number(String(draft).replace(/[,\s₦$]/g, ""));
    return draft === "" || !Number.isFinite(number) ? (field.customId ? null : 0) : number;
  }
  return typeof draft === "string" ? draft.trim() : draft;
}

// An on/off switch that says what it controls.
export function Switch({ checked, onChange, label, disabled = false, children }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`desk-switch ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)}>
      <i aria-hidden="true" />
      {children ? <span>{children}</span> : null}
    </button>
  );
}

// A small dialog in the middle of the screen. Escape and the backdrop close it.
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="desk-modal-back" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="desk-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}
