"use client";

import { ShieldCheck } from "lucide-react";
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
          <span>CW</span>
          <div>
            <strong>CW Real Estate</strong>
            <p>Admin intelligence console</p>
          </div>
        </div>
        <div className="auth-heading">
          <ShieldCheck size={18} />
          <h1>Admin sign in</h1>
          <p>Access is required to add, edit, or override intelligence data.</p>
        </div>
        <form onSubmit={login} className="auth-form">
          <label>
            <span>Email</span>
            <input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </label>
          {error ? <p>{error}</p> : null}
          {devCredentials ? (
            <small className="auth-dev-hint">
              Local default: {devCredentials.email} / {devCredentials.password}
            </small>
          ) : null}
          <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}
