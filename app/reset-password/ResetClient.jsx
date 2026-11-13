"use client";

import Link from "next/link";
import { useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import { postJson } from "@/lib/postJson";

export default function ResetClient({ token, live }) {
  const [form, setForm] = useState({ password: "", again: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(!live);
  const [done, setDone] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (form.password !== form.again) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    const { ok, body } = await postJson("/api/account/reset", { token, password: form.password });
    if (!ok) {
      setLoading(false);
      if (body.code === "expired") setExpired(true);
      else setError(body.error || "Could not change the password.");
      return;
    }
    if (body.status === "active") {
      window.location.assign("/account");
      return;
    }
    setLoading(false);
    setDone(body.status);
  }

  if (expired) {
    return (
      <AuthScreen
        title="This link no longer works"
        lede="Reset links last 60 minutes and can be used once. Ask for a new one and use it straight away."
        foot={<Link className="cw-link" href="/login">Back to sign in</Link>}
      >
        <div className="auth-form">
          <Link className="cw-btn cw-btn-navy" href="/forgot-password">Send a new link</Link>
        </div>
      </AuthScreen>
    );
  }

  if (done) {
    return (
      <AuthScreen
        title="Password changed"
        lede={done === "pending_approval"
          ? "Your new password is saved. Your agent account is still waiting for CW to approve it; we will email you when it is ready."
          : "Your new password is saved."}
        foot={<Link className="cw-link" href="/login">Go to sign in</Link>}
      />
    );
  }

  return (
    <AuthScreen title="Choose a new password" lede="You will be signed out on any other device.">
      <form onSubmit={submit} className="auth-form">
        <label className="cw-field">
          <span>New password</span>
          <input className="cw-input" type="password" autoComplete="new-password" minLength={10} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          <em className="auth-field-hint">At least 10 characters.</em>
        </label>
        <label className="cw-field">
          <span>Type it again</span>
          <input className="cw-input" type="password" autoComplete="new-password" minLength={10} value={form.again} onChange={(event) => setForm({ ...form, again: event.target.value })} required />
        </label>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <button className="cw-btn cw-btn-navy" type="submit" disabled={loading}>{loading ? "Saving..." : "Save new password"}</button>
      </form>
    </AuthScreen>
  );
}
