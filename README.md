# CW Real Estate Intelligence

A Next.js planning intelligence dashboard for evaluating Lagos development locations, neighborhood risk, approval history, and client-ready briefs.

## What Is Included

- Internal dashboard for operational tasks, signals, activity, and portfolio confidence
- Leaflet/OpenStreetMap intelligence map
- Neighborhood detail pages with editable intelligence data
- Reports ledger with split-pane report detail view
- Client-facing report pages
- Admin login for creating and editing intelligence data
- Admin-managed attachments and market research for locations and estates
- Seed data loaded automatically into PostgreSQL (production) or SQLite (local)

## Accounts

Buyers and agents can create their own accounts:

- `/signup`, `/login`, `/forgot-password`, `/account` for buyers and agents.
- A buyer can sign in once they confirm their email. An agent confirms their email and then waits for an admin to approve them at `/admin/accounts`.
- The admin login at `/admin/login` is separate and still comes from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

Accounts are stored apart from the rest of the data:

- Locally: a SQLite file, `data/accounts.db` (no setup needed).
- On Vercel: a PostgreSQL database on AWS RDS. Set `ACCOUNTS_DB_URL` to `postgres://USER:PASSWORD@HOST:5432/DBNAME`. The tables are created on first use. Without the setting, account pages fail on Vercel rather than writing to temporary storage.

Notes for RDS:

- Vercel does not run inside your AWS network, so the database must be publicly accessible and its security group must allow inbound PostgreSQL (port 5432). Use a long random password, and a database user that only owns this database.
- The connection is always encrypted. To also verify the server's certificate, put the contents of the AWS RDS certificate bundle (`global-bundle.pem`) in `ACCOUNTS_DB_CA`.
- Each server instance keeps at most 3 connections open. If traffic grows, put RDS Proxy in front and point `ACCOUNTS_DB_URL` at the proxy.

Emails (confirm address, reset password, agent approved) are sent through Resend when `RESEND_API_KEY` is set, from `MAIL_FROM`. Without the key they are printed in the server log, which is how to follow the links during local work. Set `APP_URL` to the public address so links in emails point to the right place.

In production (`next start` or Vercel) `AUTH_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` are required. The development defaults below only work under `npm run dev`.

## Tech Stack

- Next.js App Router
- React
- PostgreSQL (AWS RDS) in production through `pg`, SQLite locally through `better-sqlite3`
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

Admin login:

```text
http://localhost:4174/admin/login
```

Local development credentials default to:

```text
admin@cwrealestate.local
admin123
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

Listings, locations, reports, market data and uploaded resources live in one database:

- Locally: a SQLite file, `data/app.db`, created on first start and ignored by Git.
- In production: PostgreSQL on AWS RDS. Set `APP_DB_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME`. If `APP_DB_URL` is empty and `ACCOUNTS_DB_URL` is a PostgreSQL address, the same database is used for both; the table names do not overlap.
- With neither set on Vercel, the app falls back to a temporary SQLite file in `/tmp`, and anything an admin saves is lost when the instance restarts.

On first connection the app creates its tables and loads the seed data. Two instances starting at once are safe: one sets up, the other waits. The RDS notes under Accounts (public access, security group, `ACCOUNTS_DB_CA`) apply to this connection too.

Seed data lives in:

```text
data/neighborhoods.json
lib/reportSeeds.js
```

If `data/app.db` is missing, the app recreates it from the seed files.

### Listings

Listings come from `data/listings.json`, which is built from a CW Lagos export:

```bash
npm run import:listings -- data/imports/land_listings_2026-11-16.csv
```

The import works out whether each price is for the whole plot or per sqm, rolls the export's neighbourhoods into the site's locations, and prints the rows it was unsure of. Correct those in `data/listing-overrides.json` (`{ "<listing id>": { "priceBasis": "total", "sizeSqm": 8000 } }`) and run it again. On its next start the app replaces every imported listing with the new file; listings an admin created or edited are kept.

Prices listed in US dollars are shown in naira at the day's rate from open.er-api.com. `USD_NGN_FALLBACK` is used only if that service has never answered.

Admins can add client-visible or internal-only research resources from `/data`. Resource records can target either a neighborhood or an estate and are shown on the dashboard feed, detail pages, and related reports when marked client-visible. The current prototype stores uploaded documents in SQLite with a 15MB per-file limit; production file storage should move to object storage such as S3 or Supabase Storage.

Uploaded documents are stored in the database (15MB each); if they grow, move them to object storage such as S3.

## Deployment

This project expects Node 22.

For Vercel:

- Build command: `npm run build`
- Install command: `npm install`
- Node version: `22.x`
- Required environment variables:
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
  - `AUTH_SECRET`
  - `ACCOUNTS_DB_URL` (PostgreSQL on AWS RDS)
- Recommended: `APP_DB_URL` if listings and reports should use a different database from accounts, and `USD_NGN_FALLBACK`.

Set a strong `AUTH_SECRET` and replace the development admin credentials before deploying. The app has development fallbacks so local setup is quick, but production/Vercel should always define these values.

## GitHub Notes

Do not commit:

- `node_modules/`
- `.next/`
- `.env` files with real secrets
- `data/app.db` or SQLite WAL/SHM files
- local QA screenshots
