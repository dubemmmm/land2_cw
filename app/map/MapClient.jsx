"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, Minus, Plus, Search } from "lucide-react";
import { averageConfidence, confidenceColor, confidenceLevel, confidenceScore } from "@/lib/metrics";

export default function MapClient({ initialNeighborhoods }) {
  const [records, setRecords] = useState(initialNeighborhoods);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", jurisdiction: "Lagos" });
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerRef = useRef(null);
  const router = useRouter();

  const trackedRecords = useMemo(
    () => records.filter((n) => confidenceScore(n) >= 40).sort((a, b) => confidenceScore(b) - confidenceScore(a)),
    [records]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trackedRecords.filter((n) => {
      const score = confidenceScore(n);
      const level = confidenceLevel(score).toLowerCase();
      const matchesFilter = filter === "all" || level === filter;
      const matchesQuery = !q || `${n.name} ${n.jurisdiction}`.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [trackedRecords, query, filter]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (cancelled || !mapRef.current || mapInstance.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapRef.current || mapInstance.current) return;
      const map = L.map(mapRef.current, { zoomControl: false, attributionControl: true }).setView([6.445, 3.445], 12);
      mapInstance.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      drawPolygons(L, map, layerRef.current, trackedRecords, router);
      setTimeout(() => map.invalidateSize(), 200);
    }
    init();
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        layerRef.current = null;
      }
    };
  }, [router, trackedRecords]);

  useEffect(() => {
    let cancelled = false;
    async function redraw() {
      if (!mapInstance.current || !layerRef.current) return;
      const L = await import("leaflet");
      if (!cancelled && mapInstance.current && layerRef.current) {
        drawPolygons(L, mapInstance.current, layerRef.current, filtered, router);
      }
    }
    redraw();
    return () => {
      cancelled = true;
    };
  }, [filtered, router]);

  async function createLocation(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const res = await fetch("/api/neighborhoods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const record = await res.json();
    if (!res.ok) return;
    setRecords((current) => current.concat(record));
    setCreating(false);
    setForm({ name: "", jurisdiction: "Lagos" });
    router.push(`/locations/${record.id}`);
  }

  function zoom(delta) {
    if (!mapInstance.current) return;
    delta > 0 ? mapInstance.current.zoomIn() : mapInstance.current.zoomOut();
  }

  function recenter() {
    if (!mapInstance.current) return;
    mapInstance.current.setView([6.445, 3.445], 12);
  }

  return (
    <div className="map-shell-pro">
      <div className="map-canvas-pro" ref={mapRef} />
      <aside className="map-intel-panel">
        <header className="map-panel-head">
          <div>
            <h1>Locations</h1>
            <p>{trackedRecords.length} tracked · Lagos</p>
          </div>
          <div>
            <strong>{averageConfidence(trackedRecords)}</strong>
            <span>Avg confidence</span>
          </div>
        </header>

        <label className="map-search">
          <Search size={15} />
          <input placeholder="Search neighborhoods" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>

        <div className="map-filter-tabs">
          {["all", "high", "medium"].map((item) => (
            <button className={filter === item ? "active" : ""} type="button" key={item} onClick={() => setFilter(item)}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>

        <div className="map-location-list">
          {filtered.map((n) => {
            const score = confidenceScore(n);
            const level = confidenceLevel(score);
            return (
              <button className="map-location-row" type="button" key={n.id} onClick={() => router.push(`/locations/${n.id}`)}>
                <div className="map-score-ring" style={{ "--score": score, "--tone": confidenceColor(score) }}><span>{score}</span></div>
                <div>
                  <strong>{n.name}</strong>
                  <p>{n.jurisdiction} · {level}</p>
                </div>
                <em className={level.toLowerCase().replace(/\s+/g, "-")}>{level}</em>
                <i>›</i>
              </button>
            );
          })}
        </div>

        <footer className="map-panel-foot">
          <span>Add a neighborhood to track</span>
          <button type="button" onClick={() => setCreating(true)} aria-label="Add neighborhood"><Plus size={15} /></button>
        </footer>

        {creating && (
          <form className="map-create-form" onSubmit={createLocation}>
            <label>Neighborhood name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></label>
            <label>Jurisdiction<input value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></label>
            <div>
              <button type="submit">Create</button>
              <button type="button" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </form>
        )}
      </aside>

      <div className="map-pro-controls">
        <button type="button" onClick={() => zoom(1)} aria-label="Zoom in"><Plus size={18} /></button>
        <button type="button" onClick={() => zoom(-1)} aria-label="Zoom out"><Minus size={18} /></button>
        <button type="button" onClick={recenter} aria-label="Recenter"><LocateFixed size={17} /></button>
      </div>

      <div className="map-pro-legend">
        <span>Confidence</span>
        <em><i className="high" />High</em>
        <em><i className="medium" />Medium</em>
        <em><i className="low" />Low</em>
      </div>
      <div className="map-pro-coords">6.4550° N&nbsp;&nbsp;3.4200° E · LAGOS</div>
    </div>
  );
}

function drawPolygons(L, map, group, records, router) {
  group.clearLayers();
  records.forEach((n) => {
    const score = confidenceScore(n);
    const color = confidenceColor(score);
    const polygon = L.polygon(n.geometry?.polygon || [], {
      color,
      weight: 1.8,
      opacity: 0.9,
      fillColor: color,
      fillOpacity: score >= 70 ? 0.24 : score >= 40 ? 0.2 : 0.16
    }).addTo(group);

    polygon
      .bindTooltip(`<strong>${n.name}</strong>&nbsp;&nbsp;<span>${score}</span>`, {
        permanent: true,
        direction: "center",
        className: "map-dark-label"
      })
      .on("click", () => router.push(`/locations/${n.id}`));

    const center = n.geometry?.center;
    if (center) {
      L.circle(center, {
        radius: 540,
        stroke: false,
        fillColor: color,
        fillOpacity: 0.08
      }).addTo(group);

      L.circleMarker(center, {
        radius: 6,
        color: "#0c0906",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.92
      }).addTo(group);
    }
  });
}
