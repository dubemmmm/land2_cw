"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("cw-theme") || "light";
    setLight(stored === "light");
    document.documentElement.classList.toggle("theme-light", stored === "light");
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    localStorage.setItem("cw-theme", next ? "light" : "dark");
    document.documentElement.classList.toggle("theme-light", next);
  }

  return (
    <button className="theme-btn theme-toggle-btn" type="button" onClick={toggle} aria-label={light ? "Switch to dark mode" : "Switch to light mode"} title={light ? "Dark mode" : "Light mode"}>
      {light ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}
