"use client";

import Link from "next/link";
import { useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import { postJson } from "@/lib/postJson";

// Confirmation needs a click rather than happening on page load, so that email
// scanners that open links automatically cannot use the link up.
export default function VerifyClient({ token }) {
  const [state, setState] = useState(token ? "ready" : "failed");
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    const { ok, body } = await postJson("/api/account/verify", { token });
    setLoading(false);
    if (!ok) {
      setState("failed");
      return;
    }
    setState(body.status === "active" ? "active" : "waiting");
  }

  if (state === "active") {
    return (
      <AuthScreen title="Email confirmed" lede="Your account is ready and you are signed in.">
        <div className="auth-form">
          <a className="cw-btn cw-btn-navy" href="/account">Go to your account</a>
          <a className="cw-btn cw-btn-outline" href="/listings">See plots for sale</a>
        </div>
      </AuthScreen>
    );
  }

  if (state === "waiting") {
    return (
      <AuthScreen
        title="Email confirmed"
        lede="Thank you. CW now reviews your agent account, usually within two working days. We will email you as soon as it is approved, and you can sign in from then."
        foot={<Link className="cw-link" href="/">Back to Squaremeter</Link>}
      />
    );
  }

  if (state === "failed") {
    return (
      <AuthScreen
        title="This link no longer works"
        lede="Confirmation links last 24 hours and can be used once. If you have already confirmed your email, just sign in. Otherwise sign in with your password and we will offer to send a new link."
        foot={<Link className="cw-link" href="/">Back to Squaremeter</Link>}
      >
        <div className="auth-form">
          <Link className="cw-btn cw-btn-navy" href="/login">Go to sign in</Link>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Confirm your email" lede="One click to finish setting up your Squaremeter account.">
      <div className="auth-form">
        <button className="cw-btn cw-btn-navy" type="button" onClick={confirm} disabled={loading}>{loading ? "Confirming..." : "Confirm my email"}</button>
      </div>
    </AuthScreen>
  );
}
