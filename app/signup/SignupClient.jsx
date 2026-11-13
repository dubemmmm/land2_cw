"use client";

import Link from "next/link";
import { useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import { postJson } from "@/lib/postJson";

const roles = [
  { value: "customer", label: "I'm buying land", note: "Prices, plots and reports for buyers and investors." },
  { value: "agent", label: "I'm an agent", note: "For agents and agencies. CW approves each agent account." }
];

export default function SignupClient({ initialRole = "customer" }) {
  const [form, setForm] = useState({ role: initialRole, name: "", email: "", phone: "", company: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setErrors({});
    const { ok, body } = await postJson("/api/account/signup", form);
    setLoading(false);
    if (!ok) {
      setErrors(body.errors || {});
      setError(body.error || "Could not create the account.");
      return;
    }
    setSent(true);
  }

  async function resend() {
    await postJson("/api/account/resend", { email: form.email });
    setResent(true);
  }

  if (sent) {
    return (
      <AuthScreen
        title="Check your email"
        lede={<>We sent a link to <b>{form.email}</b>. Open it to confirm your address. The link lasts 24 hours.</>}
        foot={<Link className="cw-link" href="/login">Go to sign in</Link>}
      >
        <div className="auth-note">
          {form.role === "agent" ? <p>After you confirm, CW reviews your agent account. We will email you when it is approved.</p> : null}
          <p>
            Nothing arrived? Check your spam folder, or{" "}
            {resent ? <span>we have sent it again.</span> : <button type="button" className="auth-inline-btn" onClick={resend}>send it again</button>}
          </p>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      wide
      title="Create an account"
      lede="One account for land prices, plots for sale and your reports."
      foot={<span>Already have an account? <Link className="cw-link" href="/login">Sign in</Link></span>}
    >
      <form onSubmit={submit} className="auth-form" noValidate>
        <fieldset className="auth-roles">
          <legend>Which describes you?</legend>
          {roles.map((role) => (
            <label key={role.value} className={`auth-role ${form.role === role.value ? "is-on" : ""}`}>
              <input type="radio" name="role" value={role.value} checked={form.role === role.value} onChange={set("role")} />
              <span>
                <b>{role.label}</b>
                <small>{role.note}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <Field label="Full name" error={errors.name}>
          <input className="cw-input" autoComplete="name" value={form.name} onChange={set("name")} required />
        </Field>
        {form.role === "agent" ? (
          <Field label="Agency or company" error={errors.company}>
            <input className="cw-input" autoComplete="organization" value={form.company} onChange={set("company")} required />
          </Field>
        ) : null}
        <Field label="Email" error={errors.email}>
          <input className="cw-input" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
        </Field>
        <Field label="Phone (optional)">
          <input className="cw-input" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="Password" hint="At least 10 characters." error={errors.password}>
          <input className="cw-input" type="password" autoComplete="new-password" minLength={10} value={form.password} onChange={set("password")} required />
        </Field>
        {error && !Object.keys(errors).length ? <p className="auth-error" role="alert">{error}</p> : null}
        <button className="cw-btn cw-btn-navy" type="submit" disabled={loading}>{loading ? "Creating account..." : "Create account"}</button>
      </form>
    </AuthScreen>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <label className="cw-field">
      <span>{label}</span>
      {children}
      {error ? <em className="auth-field-error" role="alert">{error}</em> : hint ? <em className="auth-field-hint">{hint}</em> : null}
    </label>
  );
}
