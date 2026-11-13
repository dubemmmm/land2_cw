"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const defaultLinks = [
  { href: "/#index", label: "Price index" },
  { href: "/#budget", label: "What it buys" },
  { href: "/listings", label: "Plots" },
  { href: "/map", label: "Map" },
  { href: "/#method", label: "Method" }
];

export default function SiteNav({ links = defaultLinks, cta = { href: "/dashboard", label: "Open the portal" } }) {
  const [open, setOpen] = useState(false);

  return (
    <header className={`sq-nav ${open ? "open" : ""}`}>
      <nav className="sq-nav-bar" aria-label="Primary">
        <Link className="sq-brand" href="/" aria-label="Squaremeter by CW home">
          <span className="cw-mark">CW</span>
          <span>Squaremeter<sup aria-hidden="true">m²</sup></span>
        </Link>
        <button
          className="sq-nav-toggle"
          type="button"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="sq-nav-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
          ))}
        </div>
        <div className="sq-nav-actions">
          <span className="sq-nav-coords" aria-hidden="true">6.4550° N · 3.4200° E</span>
          {cta ? <Link className="cw-btn cw-btn-navy cw-btn-sm" href={cta.href}>{cta.label}</Link> : null}
        </div>
      </nav>
      <div className="sq-nav-ruler" aria-hidden="true" />
    </header>
  );
}
