"use client";

import Link from "next/link";
import { useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import { postJson } from "@/lib/postJson";

export default function ForgotClient() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { ok, body } = await postJson("/api/account/forgot", { email });
    setLoading(false);
    if (!ok) {
      setError(body.error || "Could not send the link.");
      return;
    }
    setSent(true);
  }

  const foot = <Link className="cw-link" href="/login">Back to sign in</Link>;

  if (sent) {
    return (
      <AuthScreen
        title="Check your email"
        lede={<>If <b>{email}</b> has a Squaremeter account, we have sent it a link to choose a new password. The link lasts 60 minutes.</>}
        foot={foot}
      >
        <div className="auth-note">
          <p>Nothing arrived after a few minutes? Check your spam folder and that you typed the address you signed up with.</p>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Forgot your password?" lede="Enter the email you signed up with and we will send you a link to choose a new one." foot={foot}>
      <form onSubmit={submit} className="auth-form">
        <label className="cw-field">
          <span>Email</span>
          <input className="cw-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <button className="cw-btn cw-btn-navy" type="submit" disabled={loading}>{loading ? "Sending..." : "Send reset link"}</button>
      </form>
    </AuthScreen>
  );
}
