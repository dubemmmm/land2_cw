"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const defaultLinks = [
  { href: "/#prices", label: "Prices" },
  { href: "/#budget", label: "Budget tool" },
  { href: "/listings", label: "Plots for sale" },
  { href: "/map", label: "Map" }
];

export default function SiteNav({ links = defaultLinks, cta = { href: "/dashboard", label: "Open portal" } }) {
  const [open, setOpen] = useState(false);

  return (
    <header className={`sq-nav ${open ? "open" : ""}`}>
      <nav className="sq-nav-bar" aria-label="Primary">
        <Link className="sq-brand" href="/" aria-label="Squaremeter by CW home">
          <span className="cw-mark">CW</span>
          <span>Squaremeter</span>
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
          {cta ? <Link className="cw-btn cw-btn-navy cw-btn-sm" href={cta.href}>{cta.label}</Link> : null}
        </div>
      </nav>
    </header>
  );
}
