# SIPERMIT K3

Safety Permit (PTW) management web application for PGN HSE.

## Overview

SIPERMIT K3 digitizes the Permit to Work (PTW) process for PGN and its contractors (PGSOL/vendors). It covers the full PTW lifecycle — drafting, approval, safety checks, and closure — along with supporting modules for JSA, procedures, inspections, incidents, and announcements.

## Features

- **Permit to Work (PTW)** — multi-type permits with checklist, signatories, and status tracking
- **JSA & Procedures** — job safety analysis and procedure documents with PDF export
- **Inspections** — finding reports with photo evidence
- **Incidents** — incident reporting and follow-up
- **Announcements** — news carousel for internal and vendor home pages
- **Multi-tenant & role-based** — PGN / PGSOL / vendor realms with data-driven roles and assignments
- **Approval flow** — assignment-driven, fail-closed approvals
- **Client-side PDF** — `@react-pdf/renderer` for PTW/procedure/JSA/incident documents

## Tech Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4
- Supabase (Postgres, Auth, Storage)
- `@react-pdf/renderer`, Recharts, Resend, web-push

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=        # optional
CRON_SECRET=           # required for daily reminder cron
```

### Database

Apply SQL files in `supabase/` in the order documented in `supabase/README_org_migration_order.md` and `supabase/README_stage_assignment_migration_order.md`.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — typecheck

## License

Private — PGN HSE.