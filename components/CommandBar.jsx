"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const pages = [
  { group: "Page", label: "Explore plots", href: "/listings" },
  { group: "Page", label: "Briefing", href: "/dashboard" },
  { group: "Page", label: "Planning map", href: "/map" },
  { group: "Page", label: "Reports", href: "/reports" },
  { group: "Page", label: "Signals", href: "/signals" },
  { group: "Page", label: "Public site", href: "/" }
];

async function load(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body) ? body : [];
  } catch {
    return [];
  }
}

// Jump anywhere in the portal. Opens with ⌘K / Ctrl K or the rail button.
// variant "bar": a search field for the top bar. Otherwise an icon button.
export default function CommandBar({ variant = "icon" }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [remote, setRemote] = useState(null);

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset only when the bar opens, so typing is never wiped by a late fetch.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || remote) return;
    Promise.all([load("/api/neighborhoods"), load("/api/listings"), load("/api/reports")]).then(
      ([neighborhoods, listings, reports]) => {
        setRemote([
          ...neighborhoods.map((item) => ({ group: "Location", label: item.name, meta: item.jurisdiction, href: `/locations/${item.id}` })),
          ...listings.map((item) => ({ group: "Plot", label: item.title, meta: item.neighborhoodName, href: "/listings" })),
          ...reports.map((item) => ({ group: "Report", label: item.siteTitle || item.site_title || item.ref, meta: item.ref, href: "/reports" }))
        ].filter((item) => item.label));
      }
    );
  }, [open, remote]);

  const results = useMemo(() => {
    const all = pages.concat(remote || []);
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? all.filter((item) => `${item.label} ${item.meta || ""} ${item.group}`.toLowerCase().includes(needle))
      : all;
    return matched.slice(0, 12);
  }, [query, remote]);

  function go(item) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") setOpen(false);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(results.length - 1, value + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(0, value - 1));
    }
    if (event.key === "Enter") go(results[cursor]);
  }

  return (
    <>
      {variant === "bar" ? (
        <button className="atlas-search" type="button" aria-label="Search and jump (Command K)" onClick={() => setOpen(true)}>
          <Search size={16} aria-hidden="true" />
          <span>Search plots, areas, reports</span>
          <kbd>⌘K</kbd>
        </button>
      ) : (
        <button
          className="rail-link rail-search"
          type="button"
          aria-label="Search and jump (Command K)"
          data-label="Search ⌘K"
          onClick={() => setOpen(true)}
        >
          <Search size={19} />
        </button>
      )}
      {open ? (
        <div className="sq-cmd-scrim" onMouseDown={() => setOpen(false)}>
          <div className="sq-cmd" role="dialog" aria-modal="true" aria-label="Jump to" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sq-cmd-input">
              <Search size={17} aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                placeholder="Jump to an area, plot, report or page"
                aria-label="Search"
                onChange={(event) => { setQuery(event.target.value); setCursor(0); }}
                onKeyDown={onKeyDown}
              />
              <kbd>esc</kbd>
            </div>
            <ul role="listbox" aria-label="Results">
              {results.map((item, index) => (
                <li key={`${item.group}-${item.label}-${index}`} role="option" aria-selected={index === cursor}>
                  <button type="button" className={index === cursor ? "active" : ""} onMouseEnter={() => setCursor(index)} onClick={() => go(item)}>
                    <span>{item.group}</span>
                    <strong>{item.label}</strong>
                    {item.meta ? <em>{item.meta}</em> : null}
                  </button>
                </li>
              ))}
              {!results.length ? <li className="sq-cmd-empty">Nothing matches “{query}”.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
