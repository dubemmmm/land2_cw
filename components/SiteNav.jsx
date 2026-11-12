"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const defaultLinks = [
  { href: "/#overview", label: "Overview" },
  { href: "/#intelligence", label: "Market intelligence" },
  { href: "/listings", label: "Listings" },
  { href: "/map", label: "Map" },
  { href: "/#why-lagos", label: "Why Lagos" }
];

export default function SiteNav({ links = defaultLinks, cta = { href: "/dashboard", label: "Intelligence portal" } }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="cw-nav-wrap">
      <nav className={`cw-nav ${open ? "open" : ""}`} aria-label="Primary">
        <Link className="cw-nav-brand" href="/" aria-label="Squaremeter by CW home">
          <span className="cw-mark">CW</span>
          <span>Squaremeter</span>
        </Link>
        <button
          className="cw-nav-toggle"
          type="button"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="cw-nav-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
          ))}
        </div>
        {cta ? (
          <div className="cw-nav-actions">
            <Link className="cw-btn cw-btn-navy cw-btn-sm" href={cta.href}>{cta.label}</Link>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
