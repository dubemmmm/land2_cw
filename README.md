# CabalWorks Development Intelligence

A Next.js planning intelligence dashboard for evaluating Lagos development locations, neighborhood risk, approval history, and client-ready briefs.

## What Is Included

- Internal dashboard for operational tasks, signals, activity, and portfolio confidence
- Leaflet/OpenStreetMap intelligence map
- Neighborhood detail pages with editable intelligence data
- Reports ledger with split-pane report detail view
- Client-facing report pages
- SQLite-backed seed database created automatically at runtime

## Tech Stack

- Next.js App Router
- React
- SQLite through Node's built-in `node:sqlite`
- Leaflet/OpenStreetMap
- Lucide icons

## Getting Started

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Open:

```text
http://localhost:4174
```

Build for production:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## Data

The app creates a local SQLite database at `data/app.db` when it starts. That file is intentionally ignored by Git because it is runtime data. Seed data lives in:

```text
data/neighborhoods.json
lib/reportSeeds.js
```

If `data/app.db` is missing, the app recreates it from the seed files.

## GitHub Notes

Do not commit:

- `node_modules/`
- `.next/`
- `.env` files with real secrets
- `data/app.db` or SQLite WAL/SHM files
- local QA screenshots

