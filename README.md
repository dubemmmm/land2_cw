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

The app creates a local SQLite database at `data/app.db` when it starts. That file is intentionally ignored by Git because it is runtime data. On Vercel, the app uses `/tmp/cabalworks-app.db` because the deployed project filesystem is read-only at runtime.

Seed data lives in:

```text
data/neighborhoods.json
lib/reportSeeds.js
```

If `data/app.db` is missing, the app recreates it from the seed files.

The Vercel SQLite file is ephemeral. It is fine for the current seeded demo/admin prototype, but real production data should move to a persistent database such as Vercel Postgres, Neon, Supabase, or another managed Postgres database.

## Deployment

This project expects Node 22 because it uses Node's built-in `node:sqlite` module.

For Vercel:

- Build command: `npm run build`
- Install command: `npm install`
- Node version: `22.x`
- Required environment variables: none for the current seed-data demo

## GitHub Notes

Do not commit:

- `node_modules/`
- `.next/`
- `.env` files with real secrets
- `data/app.db` or SQLite WAL/SHM files
- local QA screenshots
