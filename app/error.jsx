"use client";

import { useEffect } from "react";

// Shown when a page fails to load, most often because the database could not
// be reached. The details stay in the server log; the visitor gets a way back.
export default function PageError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-error">
      <h1>This page could not load</h1>
      <p>We could not reach our data just now. This is usually a brief connection problem.</p>
      <div className="page-error-actions">
        <button className="cw-btn cw-btn-navy" type="button" onClick={() => reset()}>Try again</button>
        <a className="cw-btn cw-btn-soft" href="/">Go to the home page</a>
      </div>
    </main>
  );
}
