# Bare Root — Handoff

_Last updated: 2026-05-28_

## What this is
Bare Root is a garden-planning SaaS (`bareroot.garden`). Top-down visual canvas: a garden holds rectangular raised beds; beds hold a grid of cells; each cell is one plant's spot. Central entity is the **Planting** (Plant + Cell + Season, with a lifecycle PLANNED → … → HARVESTED/FAILED). First user is Kyle's wife (alpha); then alpha testers; then public.

**Stack:** Next.js (App Router, customized — see `AGENTS.md`), Postgres (Neon) + Prisma, Clerk auth, Stripe billing, Tailwind + shadcn, deployed on Vercel. PWA + web-push. Plant data from Perenual (+ Wikipedia image fallback), weather from OpenWeather, email via Resend, photos in Vercel Blob, errors in Sentry.

**Dev workflow:** local folder → GitHub (`CelticWinterKyle/bare-root`) → Vercel auto-deploy on push to `main`. **No localhost testing** — changes are verified on the live deploy. Migrations apply in the Vercel build via `prisma migrate deploy` (build script in `package.json`); migration SQL is hand-written because there's no local DB.

## Current state
Feature-complete against the original product vision and audited. All work below is **deployed to production** (`main`, latest commit `f638393`). Everything is **code-traced, not click-tested** — see Known Limitations.

## Work completed this cycle (commits `cf0e0ee`→`f638393`)

**Copy cleanup**
- Removed all rendered em dashes app-wide (`cf0e0ee` + the landing pass before it); code comments/placeholders left alone.

**Code audit fixes (Batches 0–4)** — from a 4-agent code audit:
- **Plant calendar/reminders work:** Perenual imports get category-based *estimated* timing (editable on the plant page, "estimated" badge); reminders capture the real browser timezone and no longer skip forever on a missed window.
- **AI smart-layout:** accept now creates real (visible) PlantingCell footprints + validates plant ownership; ghost preview clears.
- **Dashboard-delete loop** fixed; new-signup sign-in bounce fixed (lazy `ensureDbUser`).
- **Branded `not-found` pages** (root + app) + marketing `error.tsx`.
- **Bed resize preserves plantings** (only shrink/cell-size-change drops cells); multi-cell footprints shift in-bounds instead of silently shrinking.
- **Harvest:** local date parsing (no off-by-one); totals summed per unit.
- **Stripe:** always uses a real customer (no orphans); `hadTrial` set on checkout; portal self-heals a missing customer id.
- **Account Export + Delete** in Settings (backs the privacy policy).
- **Collaborator cap** counts pending invites; existing-account invites go through consent flow.
- **Seed Inventory gated Pro** (server + UI). **Downgrade lock:** over-limit gardens/beds become read-only (banner + server enforcement); deleting extras unlocks.
- Misc: soonest-frost alert, notification-type validation, photo cap by owner, auth-aware pricing CTAs, exact-match nav, PWA maskable icon, editor mode-clear + drag guard.

**Visual-audit fixes (`3081ee9`)** — from a Claude-browser QA pass (6 of 16 findings were real):
- **Reminders + calendar deduped** (were generating one per cell); calendar cards now fully clickable → bed; "×N" count.
- **Season progress** shows "Day N of the season" when no end date (was a stuck 0%).
- **Plant-library images:** plain `<img referrerPolicy="no-referrer">` so Wikipedia/Perenual stop hotlink-blocking (same fix already used in the bed editor).
- **Rating section** gated to grown statuses.
- **Inventory "Share list"** toast feedback.
- _Not-real findings left alone:_ library cards ARE clickable, planting detail header EXISTS, empty-title submit IS blocked, Add-Bed prefill is just a placeholder, AI-tab images don't overflow, habanero capitalization is correct.

**Reminder cleanup (`3421597`, `6a66189`)**
- One-time admin route collapsed pre-existing duplicate reminders + stale frost alerts. **Already run** (result: 18 dupes + 2 stale removed). Route is idempotent and still present.

**Feature-gap build (Batches G1–G5, `46a163e`→`f638393`)** — closed the genuine vision gaps:
- **Pest & disease (informational):** `lib/services/pest-data.ts` (category defaults + crop overrides + Perenual `pest_susceptibility` → new `PlantLibrary.commonPests/commonDiseases`). Shown on plant detail + "Watch for:" on planted cells. _Not_ regional/seasonal alerts — no data source (decided with Kyle).
- **Yield estimates:** `lib/services/yield.ts` category lbs-per-sqft heuristic → "Est. yield" on planting detail (+ actual-vs-est) and per-plant "est." on season summary.
- **Spacing calculator:** `plantsPerArea` in `lib/services/spacing.ts` → "Fits per bed" on plant detail + "~N fit" on bed-editor library cards.
- **Recurring reminders:** wired the dormant `Reminder.recurring`/`recurrenceCron` — Weekly/Monthly Repeat select, dispatcher creates the next occurrence, "Repeats" badge.
- **lat/lng:** left as-is; commented as a removal candidate.

## Product decisions made
- **Plant timing for non-curated plants:** curated-first search + category-based **estimates** (labeled, user-editable). No manual-entry gate.
- **Pest/disease:** **informational only** (no fake regional/seasonal alerts — data doesn't exist cheaply).
- **Yield:** **category heuristic** (not curated per-plant).
- **Seed Inventory:** **Pro** feature.
- **Pro→Free downgrade:** **lock over-limit resources read-only** (don't delete user data).
- **lat/lng:** leave columns; remove in a future cleanup.

## Known limitations / unverified
- **Code-traced, not click-tested.** No localhost in this workflow and the assistant can't drive the authenticated browser. Rendering, mobile layout, and real interaction are unverified for everything shipped this cycle.
- **Pest & yield numbers are plausible estimates, not horticultural truth** (e.g. tomato → hornworm/blight; ~1 lb/sqft veg). Tune `lib/services/pest-data.ts` and `lib/services/yield.ts` if any crop reads wrong.
- **Plant-library images unconfirmed.** The referrer fix is the likely cause; if images still show placeholder letters after deploy, the alternative is that the Wikipedia backfill never ran on prod → run `POST /api/admin/backfill-images`. (Diagnose via the browser network tab: 403s = hotlink, fixed; no request = null URLs, needs backfill.)
- **Recurring-reminder next-occurrence** only proves out once the hourly cron actually fires.

## Pending / next steps
1. **Run a fresh visual-audit browser pass** on the now-complete app (covers all new UI + mobile + the behavioral fixes). The single most important answer: do library images load? A scoped brief was drafted in conversation — re-request it.
2. **Confirm image loading**; run the backfill if needed (above).
3. **Deferred (low value, logged):** mass-add progress bar (works, just serial); footprint hover-preview (the in-bounds shift fixed the real bug); PWA `start_url` kept at `/dashboard`.
4. **Future cleanup:** drop unused `Garden.locationLat/locationLng`; consider tokenizing the color palette (named tokens exist in `app/globals.css` but components hardcode hex).

## Operational notes
- **Migrations:** hand-write SQL under `prisma/migrations/<timestamp>_<name>/migration.sql`; it runs on the next Vercel build. Use `NOT NULL DEFAULT` for added columns (existing rows). Run `npx prisma generate` locally after schema edits so types are current.
- **Per-batch process:** `npx tsc --noEmit` + `npx eslint <changed files>` → commit → push → confirm the Vercel deploy goes READY (especially when a migration is included). Known pre-existing lint warnings (`Date.now()` in render, set-state-in-effect in BedGrid, a component-in-render in RemindersClient) are non-blocking — Next 16 doesn't run ESLint during `next build`.
- **Admin routes** (`/api/admin/*`) auth via `x-admin-secret: $CRON_SECRET`. **`CRON_SECRET` is a write-only/sensitive Vercel var — it cannot be read back** (not via MCP, not via `vercel env pull`). The reminder-cleanup route therefore also has an **owner-only GET** trigger (gated to the owner's Clerk session): visit `GET /api/admin/cleanup-reminders` while signed in as the owner. Idempotent.
- **Crons** (`vercel.json`): `dispatch-reminders` hourly, `refresh-weather` every 3h, `frost-check` daily.

## Where things live
- Server actions: `app/actions/*.ts` (planting, bed, garden, plants, reminders, tracking, collaborators, seasons, smart-layout, account, user, location, onboarding).
- Services: `lib/services/*` (pest-data, yield, spacing, reminders, succession, crop-rotation, smart-layout, planting-calendar, plant-timing).
- Auth/user creation: `lib/auth.ts` + `lib/ensure-user.ts` (shared by the Clerk webhook).
- Tier logic: `lib/tier.ts` (limits, lock helpers).
- Canvas/editor: `components/canvas/*` (BedGrid, CellDetail, PlantLibrary, PlantPicker, GardenOverview[2D], GardenCanvasToggle, SmartLayoutPanel).
- API: `app/api/{cron,webhooks,stripe,push,admin}/*`.
- Schema: `prisma/schema.prisma`.

## Memory / context
The assistant keeps cross-session memory under `~/.claude/projects/.../memory/` — notably `project_audit_2026_05_27.md` (the canonical audit backlog, marked resolved with the feature-gap build appended) and `project_garden_saas.md` (the product vision). The completed build plan is at `~/.claude/plans/breezy-kindling-valley.md`.
