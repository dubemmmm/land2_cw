"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginClient({ next = "/data", devHint = false }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error || "Could not sign in");
      return;
    }
    router.replace(next || "/data");
    router.refresh();
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="cw-mark">CW</span>
          <span>Squaremeter <small>by CW</small></span>
        </div>
        <div className="auth-heading">
          <h1>Admin sign in</h1>
          <p>Sign in to add or edit location data, listings and reports.</p>
        </div>
        <form onSubmit={login} className="auth-form">
          <label className="cw-field">
            <span>Email</span>
            <input className="cw-input" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label className="cw-field">
            <span>Password</span>
            <input className="cw-input" type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </label>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {devHint ? (
            <p className="auth-dev-hint">
              No admin account is configured in this environment, so the local development default applies. Set the admin email and password before deploying.
            </p>
          ) : null}
          <button className="cw-btn cw-btn-navy" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
        <div className="auth-foot">
          <div className="auth-foot-rows">
            <span>Not CW staff? <Link className="cw-link" href="/login">Sign in to your account</Link></span>
            <Link className="cw-link" href="/">Back to the public site</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
