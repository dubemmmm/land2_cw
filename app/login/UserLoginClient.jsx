"use client";

import Link from "next/link";
import { useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import { postJson } from "@/lib/postJson";

export default function UserLoginClient({ next = "/account" }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setProblem(null);
    setResent(false);
    const { ok, body } = await postJson("/api/account/login", form);
    if (!ok) {
      setLoading(false);
      setProblem({ message: body.error || "Could not sign in.", code: body.code });
      return;
    }
    // A full load, so every part of the page sees the new session.
    window.location.assign(next);
  }

  async function resend() {
    await postJson("/api/account/resend", { email: form.email });
    setResent(true);
  }

  return (
    <AuthScreen
      title="Sign in"
      lede="For buyers and agents with a Squaremeter account."
      foot={
        <div className="auth-foot-rows">
          <span>New here? <Link className="cw-link" href="/signup">Create an account</Link></span>
          <span>CW staff? <Link className="cw-link" href="/admin/login">Admin sign in</Link></span>
        </div>
      }
    >
      <form onSubmit={submit} className="auth-form">
        <label className="cw-field">
          <span>Email</span>
          <input className="cw-input" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        </label>
        <label className="cw-field">
          <span className="auth-label-row">Password <Link className="cw-link" href="/forgot-password">Forgot password?</Link></span>
          <input className="cw-input" type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        </label>
        {problem ? (
          <p className={problem.code === "pending_approval" ? "auth-notice" : "auth-error"} role="alert">
            {problem.message}
            {problem.code === "unverified" ? (
              <>
                {" "}
                {resent ? <span>We have sent a new link.</span> : <button type="button" className="auth-inline-btn" onClick={resend}>Send the link again</button>}
              </>
            ) : null}
          </p>
        ) : null}
        <button className="cw-btn cw-btn-navy" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </AuthScreen>
  );
}
