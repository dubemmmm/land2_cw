"use client";

import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/lib/postJson";

const statusNames = {
  pending_email: "Email not confirmed",
  pending_approval: "Awaiting approval",
  active: "Active",
  suspended: "Suspended",
  declined: "Declined"
};
const roleNames = { customer: "Buyer", agent: "Agent" };
const day = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function AccountsAdminClient({ initialUsers }) {
  const [users, setUsers] = useState(initialUsers);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const waiting = users.filter((user) => user.status === "pending_approval");
  const agents = users.filter((user) => user.role === "agent").length;

  async function act(user, action) {
    setBusy(user.id);
    setError("");
    const { ok, body } = await postJson(`/api/admin/accounts/${user.id}`, { action });
    setBusy("");
    if (!ok) {
      setError(body.error || "Could not update the account.");
      return;
    }
    setUsers((list) => list.map((item) => (item.id === user.id ? body.user : item)));
  }

  return (
    <div className="acct-admin">
      <header className="cw-pagehead">
        <div>
          <nav className="cw-crumbs" aria-label="Breadcrumb">
            <Link href="/">Squaremeter</Link>
            <span aria-hidden="true">/</span>
            <span>Accounts</span>
          </nav>
          <h1 className="cw-pagehead-title">Accounts</h1>
          <p className="acct-admin-lede">
            {users.length} {users.length === 1 ? "person has" : "people have"} signed up: {users.length - agents} {users.length - agents === 1 ? "buyer" : "buyers"} and {agents} {agents === 1 ? "agent" : "agents"}.
            {waiting.length ? ` ${waiting.length} ${waiting.length === 1 ? "agent is" : "agents are"} waiting for your approval.` : " No agent is waiting for approval."}
          </p>
        </div>
      </header>

      {error ? <p className="auth-error acct-admin-error" role="alert">{error}</p> : null}

      {waiting.length ? (
        <section className="acct-card acct-admin-card" aria-labelledby="acct-waiting">
          <h2 id="acct-waiting">Agents waiting for approval</h2>
          <ul className="acct-waiting">
            {waiting.map((user) => (
              <li key={user.id}>
                <div>
                  <b>{user.name}</b>
                  <span>{user.company || "No company given"} · <a href={`mailto:${user.email}`}>{user.email}</a>{user.phone ? ` · ${user.phone}` : ""} · signed up {day(user.createdAt)}</span>
                </div>
                <div className="acct-actions">
                  <button className="cw-btn cw-btn-navy cw-btn-sm" type="button" disabled={busy === user.id} onClick={() => act(user, "approve")}>Approve</button>
                  <button className="cw-btn cw-btn-outline cw-btn-sm" type="button" disabled={busy === user.id} onClick={() => act(user, "decline")}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="acct-card acct-admin-card" aria-labelledby="acct-all">
        <h2 id="acct-all">All accounts</h2>
        {users.length ? (
          <div className="acct-tablewrap">
            <table className="acct-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                  <th scope="col">Signed up</th>
                  <th scope="col"><span className="acct-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <th scope="row">{user.name}{user.company ? <small>{user.company}</small> : null}</th>
                    <td>{roleNames[user.role] || user.role}</td>
                    <td><a href={`mailto:${user.email}`}>{user.email}</a></td>
                    <td><span className={`acct-status acct-status-${user.status}`}>{statusNames[user.status] || user.status}</span></td>
                    <td className="sq-fig">{day(user.createdAt)}</td>
                    <td className="acct-actions">
                      {user.status === "active" ? <button className="cw-btn cw-btn-outline cw-btn-sm" type="button" disabled={busy === user.id} onClick={() => act(user, "suspend")}>Suspend</button> : null}
                      {user.status === "suspended" || user.status === "declined" ? <button className="cw-btn cw-btn-outline cw-btn-sm" type="button" disabled={busy === user.id} onClick={() => act(user, "reinstate")}>Reinstate</button> : null}
                      {user.status === "pending_approval" ? <button className="cw-btn cw-btn-navy cw-btn-sm" type="button" disabled={busy === user.id} onClick={() => act(user, "approve")}>Approve</button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="acct-empty">Nobody has signed up yet. Accounts appear here as soon as someone registers.</p>
        )}
      </section>
    </div>
  );
}
