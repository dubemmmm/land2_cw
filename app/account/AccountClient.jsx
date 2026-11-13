"use client";

import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/lib/postJson";

const roleNames = { customer: "Buyer", agent: "Agent" };

export default function AccountClient({ initialUser }) {
  const [user, setUser] = useState(initialUser);
  const [profile, setProfile] = useState({ name: initialUser.name, phone: initialUser.phone, company: initialUser.company });
  const [profileState, setProfileState] = useState({ loading: false, error: "", saved: false });
  const [passwords, setPasswords] = useState({ current: "", next: "", again: "" });
  const [passwordState, setPasswordState] = useState({ loading: false, error: "", saved: false });
  const joined = new Date(user.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  async function saveProfile(event) {
    event.preventDefault();
    setProfileState({ loading: true, error: "", saved: false });
    const { ok, body } = await postJson("/api/account/profile", profile);
    if (!ok) {
      setProfileState({ loading: false, error: body.error || "Could not save your details.", saved: false });
      return;
    }
    setUser(body.user);
    setProfileState({ loading: false, error: "", saved: true });
  }

  async function savePassword(event) {
    event.preventDefault();
    if (passwords.next !== passwords.again) {
      setPasswordState({ loading: false, error: "The two new passwords do not match.", saved: false });
      return;
    }
    setPasswordState({ loading: true, error: "", saved: false });
    const { ok, body } = await postJson("/api/account/password", { current: passwords.current, next: passwords.next });
    if (!ok) {
      setPasswordState({ loading: false, error: body.error || "Could not change your password.", saved: false });
      return;
    }
    setPasswords({ current: "", next: "", again: "" });
    setPasswordState({ loading: false, error: "", saved: true });
  }

  async function signOut() {
    await postJson("/api/account/logout");
    window.location.assign("/");
  }

  return (
    <>
      <header className="acct-head">
        <div>
          <h1 className="cw-h2">{user.name}</h1>
          <p>{roleNames[user.role] || "Member"} account{user.company ? ` · ${user.company}` : ""} · {user.email} · joined {joined}</p>
        </div>
        <button className="cw-btn cw-btn-outline cw-btn-sm" type="button" onClick={signOut}>Sign out</button>
      </header>

      <section className="acct-links" aria-label="Where to go next">
        <Link href="/listings">Plots for sale</Link>
        <Link href="/#prices">Prices by location</Link>
        <Link href="/map">Map</Link>
        <Link href="/reports">Reports</Link>
      </section>

      <div className="acct-grid">
        <section className="acct-card" aria-labelledby="acct-details">
          <h2 id="acct-details">Your details</h2>
          <form className="auth-form" onSubmit={saveProfile}>
            <label className="cw-field">
              <span>Full name</span>
              <input className="cw-input" autoComplete="name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required />
            </label>
            {user.role === "agent" ? (
              <label className="cw-field">
                <span>Agency or company</span>
                <input className="cw-input" autoComplete="organization" value={profile.company} onChange={(event) => setProfile({ ...profile, company: event.target.value })} required />
              </label>
            ) : null}
            <label className="cw-field">
              <span>Phone</span>
              <input className="cw-input" type="tel" autoComplete="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
            </label>
            <label className="cw-field">
              <span>Email</span>
              <input className="cw-input" type="email" value={user.email} disabled />
              <em className="auth-field-hint">To change your email, write to hello@cwlagos.com.</em>
            </label>
            {profileState.error ? <p className="auth-error" role="alert">{profileState.error}</p> : null}
            {profileState.saved ? <p className="auth-success" role="status">Details saved.</p> : null}
            <button className="cw-btn cw-btn-navy" type="submit" disabled={profileState.loading}>{profileState.loading ? "Saving..." : "Save details"}</button>
          </form>
        </section>

        <section className="acct-card" aria-labelledby="acct-password">
          <h2 id="acct-password">Change password</h2>
          <form className="auth-form" onSubmit={savePassword}>
            <label className="cw-field">
              <span className="auth-label-row">Current password <Link className="cw-link" href="/forgot-password">Forgot it?</Link></span>
              <input className="cw-input" type="password" autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} required />
            </label>
            <label className="cw-field">
              <span>New password</span>
              <input className="cw-input" type="password" autoComplete="new-password" minLength={10} value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} required />
              <em className="auth-field-hint">At least 10 characters. Other devices will be signed out.</em>
            </label>
            <label className="cw-field">
              <span>Type the new password again</span>
              <input className="cw-input" type="password" autoComplete="new-password" minLength={10} value={passwords.again} onChange={(event) => setPasswords({ ...passwords, again: event.target.value })} required />
            </label>
            {passwordState.error ? <p className="auth-error" role="alert">{passwordState.error}</p> : null}
            {passwordState.saved ? <p className="auth-success" role="status">Password changed.</p> : null}
            <button className="cw-btn cw-btn-navy" type="submit" disabled={passwordState.loading}>{passwordState.loading ? "Saving..." : "Change password"}</button>
          </form>
        </section>
      </div>
    </>
  );
}
