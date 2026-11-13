"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const initials = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

// Shows who is signed in. Fetched in the browser so pages can stay cached.
// variant "nav": text link for the public top bar. variant "rail": initials for the portal rail.
export default function AccountBadge({ variant = "nav" }) {
  const [state, setState] = useState(null);

  useEffect(() => {
    let live = true;
    fetch("/api/account/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => { if (live) setState(body); })
      .catch(() => { if (live) setState({ user: null, admin: false }); });
    return () => { live = false; };
  }, []);

  if (variant === "rail") {
    if (state?.user) {
      return <Link className="avatar" href="/account" aria-label={`Your account: ${state.user.name}`} title={state.user.name}>{initials(state.user.name)}</Link>;
    }
    if (state?.admin) return <span className="avatar" title="Signed in as CW admin">CW</span>;
    return null;
  }

  if (!state) return <span className="sq-nav-account" aria-hidden="true" />;
  if (state.user) return <Link className="sq-nav-account" href="/account">{state.user.name.split(/\s+/)[0]}</Link>;
  return <Link className="sq-nav-account" href="/login">Sign in</Link>;
}
