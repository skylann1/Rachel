<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SIPERMIT K3 — repository guide

Safety-permit (PTW) management app for PGN HSE. Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Supabase (Postgres + Auth + Storage). Domain text and code comments are Indonesian.

## Commands
- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` — ESLint 9 flat config (`eslint.config.mjs`)
- `npx tsc --noEmit` — typecheck; there is no `typecheck` script and **no test framework / test script** — build is the closest verification.
- Both `package-lock.json` and `pnpm-workspace.yaml` are tracked, while `pnpm-lock.yaml` is untracked. Don't commit regenerated lockfiles that don't match the tracked one.

## Three app realms in one Next.js app
- `/dashboard/*` — internal PGN app (master-data, approval, incidents, inspections)
- `/vendor/*` and `/pgsol/*` — vendor and PGSOL apps
Each realm has its own login page, server actions, and layout. `profiles.type` (`pgn | pgsol | vendor`) drives post-login redirects in `middleware.ts` / `utils/supabase/middleware.ts`. Roles are data-driven: `roles` table + `roles.permissions` JSONB, role UI in `app/*/dashboard/role/`.

## Supabase schema changes are manual SQL files, not a migration runner
- The DB is versioned as `supabase/schema_*.sql` applied **by hand in the Supabase SQL editor**, in the exact order documented in `supabase/README_org_migration_order.md` and `supabase/README_stage_assignment_migration_order.md` (Fase 1 → 3.1). Many files are not idempotent and some MUST be their own transaction; never reorder or re-run backfills.
- `supabase/schema.sql` is the base; `supabase/RUN_ALL_migrations_2026-08-30.sql` is the combined-run convenience file.
- A schema change = a new `supabase/schema_*.sql` file (and a README note), mirroring recent commits (e.g. `schema_ptw_safety_checklist.sql`).

## Multi-tenant org scoping — easy to get wrong
Since the org foundation, `projects.vendor_id` and the `vendor_*` tables store the vendor **organization id** (`organizations.id`), not `auth.uid()`. Server-side vendor-scoped queries must resolve the org via `getCallerVendorOrgId()` (`utils/supabase/server.ts`). Never scope vendor data by `auth.uid()`.

## Approval flow is assignment-driven and fail-closed
- Since the stage-assignment phases, `approve*` actions require a **pending `stage_assignments` row** for `(project, doc_type, stage_key, user)`. Holding the permission is NOT sufficient. Permissions (`utils/permissions.ts`) gate UI/actions; assignments gate approvals.
- A new approval stage needs: a permission key in the role-constants module (e.g. `app/dashboard/master-data/role/constants.ts`) AND an assignment slot + flow in `lib/stage-assignments.ts`.
- Known limitation: one assignment row per `(project, doc_type, stage_key)` is shared by all docs of that type on a project (only PTW can have several). Concurrent same-type PTWs share approval state — keep their stages sequential.
- Workflow/status/config lives in `lib/`: `*-status.ts`, `ptw-types.ts` (`PTW_TYPES[...].checklist`), `*-signatories.ts`.

## PDFs are client-side
PTW/Prosedur/JSA/Incident documents render via `@react-pdf/renderer` components (`components/ptw/PtwPDF.tsx`, `*/*PDF.tsx`) + `PDFDownloadLink`. No server PDF route.

## Design docs
Larger features get a dated spec/plan under `docs/superpowers/specs/` and `docs/superpowers/plans/` (e.g. `2026-09-14-ptw-safety-checklist-fill-*`). Read the latest before touching approval/workflow features.

## Env
`.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (for `utils/supabase/admin.ts`). `RESEND_API_KEY` is optional — senders in `lib/email.ts` silently no-op without it.

## Ignore
- `.claude/worktrees/` — stale feature worktrees with their own `node_modules`; don't edit or search there.
- `scratch/`, `1. Review 1/`, and loose PDFs at repo root — user artifacts, untracked.