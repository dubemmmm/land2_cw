"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginClient({ next = "/data", devCredentials = null }) {
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
          <div>
            <strong>Squaremeter by CW</strong>
            <p>Admin intelligence console</p>
          </div>
        </div>
        <div className="auth-heading">
          <h1>Admin sign in</h1>
          <p>Access is required to add, edit, or override intelligence data.</p>
        </div>
        <form onSubmit={login} className="auth-form">
          <label>
            <span>Email</span>
            <input className="cw-input" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            <span>Password</span>
            <input className="cw-input" type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </label>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {devCredentials ? (
            <small className="auth-dev-hint">
              Local default: {devCredentials.email} / {devCredentials.password}
            </small>
          ) : null}
          <button className="cw-btn cw-btn-navy" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
        <div className="auth-foot">
          <Link className="cw-link" href="/">Back to Squaremeter</Link>
        </div>
      </section>
    </main>
  );
}
