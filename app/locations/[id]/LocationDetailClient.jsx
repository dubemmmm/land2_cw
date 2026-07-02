"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ExternalLink, FileText, Map, Pencil, Save, Share2 } from "lucide-react";
import { useState } from "react";
import { SourcePill, StatusPill } from "@/components/Pills";
import { confidenceColor, confidenceLevel, confidenceScore, formatDate, initials } from "@/lib/metrics";

export default function LocationDetailClient({ neighborhood }) {
  const [record, setRecord] = useState(neighborhood);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toDraft(neighborhood));
  const router = useRouter();
  const score = confidenceScore(record);
  const level = confidenceLevel(score);
  const tone = confidenceColor(score);
  const tags = [
    record.intelligence?.buildParameters?.[0]?.value,
    record.jurisdiction?.split("/").pop()?.trim(),
    shortSignal(record.intelligence?.redFlags?.[0])
  ].filter(Boolean);

  async function save(event) {
    event.preventDefault();
    const patch = {
      recommendation: {
        headline: draft.headline,
        bestNextAction: draft.bestNextAction,
        confidence: Number(draft.confidence),
        confidenceReason: draft.confidenceReason,
        riskLevel: draft.riskLevel
      },
      metadata: {
        reviewedBy: draft.reviewedBy,
        lastReviewed: new Date().toISOString().slice(0, 10),
        freshness: "Current",
        reviewStatus: "Saved to database"
      }
    };
    const res = await fetch(`/api/neighborhoods/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const updated = await res.json();
    if (!res.ok) return;
    setRecord(updated);
    setDraft(toDraft(updated));
    setEditing(false);
    router.refresh();
  }

  async function shareLocation() {
    if (!navigator?.clipboard) return;
    await navigator.clipboard.writeText(window.location.href);
  }

  return (
    <div className="focus-page">
      <header className="focus-topbar">
        <div className="focus-titlebar">
          <Link className="focus-back" href="/map"><ArrowLeft size={15} /> Back to map</Link>
          <span className="focus-divider" />
          <button className="focus-location-select" type="button">
            {record.name}
            <ChevronDown size={15} />
          </button>
        </div>
        <div className="focus-actions">
          <button className="focus-icon-btn" type="button" onClick={shareLocation} aria-label="Copy location link"><Share2 size={16} /></button>
          <button className="focus-icon-btn" type="button" onClick={() => setEditing(true)} aria-label="Edit intelligence"><Pencil size={16} /></button>
          <Link className="focus-report-btn" href={`/reports?report=report-${record.id}`}><FileText size={15} /> Open report</Link>
        </div>
      </header>

      <section className="focus-grid">
        <aside className="focus-left">
          <article className="focus-hero-panel">
            <div className="focus-score-chip">
              <i style={{ background: tone }} />
              <span>{score}</span>
              <em>{level}</em>
            </div>
            <div>
              <span>Satellite / aerial</span>
              <h1>{record.name}</h1>
              <p>{record.recommendation?.summary}</p>
            </div>
          </article>

          <div className="focus-tags">
            {tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>

          <article className="focus-confidence-card">
            <div className="focus-ring" style={{ "--score": score, "--tone": tone }}>
              <span>{score}</span>
            </div>
            <div>
              <span className="focus-eyebrow">Development confidence</span>
              <h2 style={{ color: tone }}>{level} <small>{score} / 100</small></h2>
              <p>{record.recommendation?.confidenceReason}</p>
              <footer>Last reviewed {formatDate(record.metadata?.lastReviewed)} · {record.metadata?.reviewedBy}</footer>
            </div>
          </article>

          <article className="focus-mini-map">
            <svg viewBox="0 0 520 220" role="img" aria-label={`${record.name} context map`}>
              <g className="focus-map-grid">
                <path d="M0 86H520M0 166H520M102 0L120 220M300 0L318 220" />
              </g>
              <polygon className="focus-map-poly medium" points="36,86 68,36 176,28 208,82 174,132 76,142" />
              <polygon className="focus-map-poly active" points="236,102 360,94 402,146 372,190 250,202 216,142" style={{ "--tone": tone }} />
              <polygon className="focus-map-poly low" points="416,62 518,54 560,106 518,168 420,178 382,116" />
              <circle cx="304" cy="138" r="8" className="focus-map-dot" style={{ "--tone": tone }} />
            </svg>
            <Link className="focus-map-link" href="/map"><ExternalLink size={14} /> View on map</Link>
          </article>
        </aside>

        <main className="focus-brief">
          <section className="focus-section">
            <SectionHeading title="What you can build" />
            <div className="focus-build-grid">
              {(record.intelligence?.buildParameters || []).map((row) => (
                <article className="focus-build-item" key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                  <SourcePill type={row.sourceType} />
                </article>
              ))}
            </div>
          </section>

          <section className="focus-section">
            <SectionHeading title="Regulations" meta={`${record.intelligence?.constraints?.length || 0} rules`} />
            <div className="focus-rule-list">
              {(record.intelligence?.constraints || []).map((row) => (
                <div className="focus-rule-row" key={row.label}>
                  <p>{row.label}</p>
                  <SourcePill type={row.sourceType} />
                </div>
              ))}
            </div>
          </section>

          <section className="focus-section">
            <SectionHeading title="Approval history" />
            <div className="focus-timeline">
              {(record.approvals || []).map((row, index) => (
                <article className="focus-history-row" key={`${row.date}-${index}`}>
                  <i className={String(row.outcome).toLowerCase()} />
                  <div>
                    <time>{formatDate(row.date)}</time>
                    <p>{row.request || row.projectType}</p>
                  </div>
                  <StatusPill status={row.outcome} />
                </article>
              ))}
            </div>
          </section>

          <section className="focus-section">
            <SectionHeading title="Team notes" />
            <div className="focus-note-list">
              {(record.notes || []).map((note, index) => (
                <article className="focus-note-row" key={`${note.date}-${index}`}>
                  <span>{initials(note.author)}</span>
                  <div>
                    <p>{note.text}</p>
                    <small>{note.author} · {formatDate(note.date)}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </section>

      {editing && (
        <div className="focus-edit-card">
          <div className="section-title">
            <h2>Edit intelligence</h2>
            <button className="btn" type="button" onClick={() => setEditing(false)}>Close</button>
          </div>
          <form className="admin-form" onSubmit={save}>
            <label>Recommendation headline<textarea value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} /></label>
            <label>Best next action<textarea value={draft.bestNextAction} onChange={(e) => setDraft({ ...draft, bestNextAction: e.target.value })} /></label>
            <label>Confidence score<input type="number" min="0" max="100" value={draft.confidence} onChange={(e) => setDraft({ ...draft, confidence: e.target.value })} /></label>
            <label>Confidence reason<textarea value={draft.confidenceReason} onChange={(e) => setDraft({ ...draft, confidenceReason: e.target.value })} /></label>
            <label>Risk level<select value={draft.riskLevel} onChange={(e) => setDraft({ ...draft, riskLevel: e.target.value })}>{["Low", "Medium", "High", "Unknown"].map((risk) => <option key={risk}>{risk}</option>)}</select></label>
            <label>Reviewer<input value={draft.reviewedBy} onChange={(e) => setDraft({ ...draft, reviewedBy: e.target.value })} /></label>
            <button className="btn primary" type="submit"><Save size={16} /> Save changes</button>
          </form>
        </div>
      )}
    </div>
  );
}

function SectionHeading({ title, meta }) {
  return (
    <div className="focus-section-head">
      <h2><i />{title}</h2>
      {meta ? <span>{meta}</span> : null}
    </div>
  );
}

function toDraft(record) {
  return {
    headline: record.recommendation?.headline || "",
    bestNextAction: record.recommendation?.bestNextAction || "",
    confidence: record.recommendation?.confidence || 0,
    confidenceReason: record.recommendation?.confidenceReason || "",
    riskLevel: record.recommendation?.riskLevel || "Unknown",
    reviewedBy: record.metadata?.reviewedBy || "Admin"
  };
}

function shortSignal(value = "") {
  const text = String(value);
  if (/drain/i.test(text)) return "Drainage review";
  if (/height/i.test(text)) return "Height sensitivity";
  if (/commercial/i.test(text)) return "Commercial control";
  return text.split(/\s+/).slice(0, 2).join(" ");
}
