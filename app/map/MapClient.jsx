"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LocateFixed, Minus, Plus, Search } from "lucide-react";
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
        attribution: "&copy; OpenStreetMap contributors"
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
      <div className="map-stage">
        <div className="map-canvas-pro" ref={mapRef} />

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
        <div className="map-pro-coords">6.4550° N&nbsp;&nbsp;3.4200° E · Lagos</div>
      </div>

      <aside className="map-intel-panel">
        <header className="map-panel-head">
          <div>
            <h1>Locations</h1>
            <p>{trackedRecords.length} tracked · Lagos</p>
          </div>
          <div className="map-panel-stat">
            <strong>{averageConfidence(trackedRecords)}</strong>
            <span>Avg confidence</span>
          </div>
        </header>

        <label className="map-search">
          <Search size={16} />
          <input placeholder="Search neighborhoods" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>

        <div className="cw-tabs map-filter-tabs">
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
                <div className="map-location-text">
                  <strong>{n.name}</strong>
                  <p>{n.jurisdiction} · {level}</p>
                </div>
                <span className="map-location-score" title={`${level} confidence`}>
                  <i style={{ background: confidenceColor(score) }} />
                  {score}
                </span>
                <ChevronRight className="map-location-chevron" size={16} aria-hidden="true" />
              </button>
            );
          })}
          {filtered.length === 0 && <p className="map-location-empty">No neighborhoods match this search.</p>}
        </div>

        <footer className="map-panel-foot">
          <span>Add a neighborhood to track</span>
          <button className="cw-btn cw-btn-navy cw-btn-sm" type="button" onClick={() => setCreating(true)} aria-label="Add neighborhood">
            <Plus size={16} />
            Add
          </button>
        </footer>

        {creating && (
          <form className="map-create-form" onSubmit={createLocation}>
            <label className="cw-field">Neighborhood name<input className="cw-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></label>
            <label className="cw-field">Jurisdiction<input className="cw-input" value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></label>
            <div className="map-create-actions">
              <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit">Create</button>
              <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </form>
        )}
      </aside>
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
        className: "map-label"
      })
      .on("mouseover", () => polygon.setStyle({ color: "#111D42", weight: 2.6, opacity: 1 }))
      .on("mouseout", () => polygon.setStyle({ color, weight: 1.8, opacity: 0.9 }))
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
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.92
      }).addTo(group);
    }
  });
}
