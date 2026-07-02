"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle({ icon }) {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("di-theme") || "dark";
    setLight(stored === "light");
    document.documentElement.classList.toggle("theme-light", stored === "light");
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    localStorage.setItem("di-theme", next ? "light" : "dark");
    document.documentElement.classList.toggle("theme-light", next);
  }

  return (
    <button className="theme-btn" type="button" onClick={toggle} aria-label="Toggle light and dark mode">
      {icon}
    </button>
  );
}
