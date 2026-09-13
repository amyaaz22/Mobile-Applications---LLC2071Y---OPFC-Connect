# OPFC Connect — Claude Code Project Brief

## What This Is
A full-stack Progressive Web App for **Oasis Pailles Football Club** (Pailles, Mauritius).
Built for the club's daily operations AND as a Year 3 BSc dissertation project.

**Student:** Amyaaz Aumeer | ID: 2400223  
**Supervisor:** Dr Santally  
**Dissertation Title:** "Developing a Progressive Web Application for Football Academy Management with Role-Based Access Control"  
**Submission:** 5 April 2027

---

## Live URLs
- **Production:** https://opfc-connect-9mlf.vercel.app
- **GitHub:** https://github.com/amyaaz22/Mobile-Applications---LLC2071Y---OPFC-Connect
- **Supabase Project:** https://vesfyvzahggbckpnoteh.supabase.co

## Deployment
- Push to GitHub main → Vercel auto-deploys (takes ~1 min)
- Always run `npm run build` locally before pushing to catch errors
- Environment variables are set in Vercel dashboard (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
- **Before this deploys correctly, run `schema_v3_additions.sql` through `schema_v6_additions.sql` in the Supabase SQL Editor**, in order (all additive — safe on the live DB, and all already applied on the live project as of this writing). v3 adds expenses/income/inventory tables, fixes a profile role-escalation hole, widens payments.type, converts point_rules/global_awards category columns to arrays. v4 frees players.position / announcements.tag / inventory_items.condition from their old CHECK constraints (Club Settings → Dropdown Lists now owns those lists), seeds the new dropdown-list keys, and adds profiles.permissions for granular admin access. v5 adds the field_sheets table (Field Sheets feature). v6 adds payments.reference (optional transaction ref), income.receipt_url, a private `receipts` storage bucket for expense/income attachments, and seeds categories/fees/club_info if missing.
- Coach/parent invites (Staff & Parents page) send real emails via Supabase Auth — needs an email provider configured in the Supabase project (default Supabase SMTP is rate-limited; for real usage swap in a custom SMTP provider under Auth settings)

---

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Hosting | Vercel (free tier) |
| Charts | Recharts |
| PDF | jsPDF + html2canvas |
| QR | html5-qrcode + qrcode |
| Excel | SheetJS (xlsx) |
| PWA | Custom service worker in public/sw.js |

---

## Design System
- **Primary bg:** `#0D1B2A` (navy)
- **Accent:** `#4EC6C6` (teal)
- **Font:** Inter (body), Barlow Condensed (headings/numbers)
- CSS classes: `card`, `card-hover`, `btn-primary`, `btn-secondary`, `btn-danger`, `input`, `label`, `badge`, `section-title`, `page-title` — all defined in globals.css

---

## Architecture Decisions (CRITICAL)
1. **All auth is 100% client-side** — middleware.ts does NOT check sessions server-side (caused cookie issues with Vercel). All role checking happens in `CoachGuard`, `ParentGuard`, `PlayerGuard` client components.
2. **All dashboard pages are `'use client'`** — no server components for data fetching. Use `createClient()` from `@/lib/supabase/client` everywhere.
3. **After login:** `window.location.href = '/'` — hard reload, not router.push
4. **Server client** (`@/lib/supabase/server`) is ONLY used in API routes.
5. **Never include `ovr` in player_stats upsert** — it's a GENERATED ALWAYS column.

---

## User Roles
| Role | Access | Dashboard |
|---|---|---|
| `admin` | Everything, incl. Staff & Parents page | /coach/* |
| `coach` | Club data (see note below) | /coach/* |
| `parent` | Their child only | /parent/* |
| `player` | Their own data | /player/* |

**To set the first admin:** `UPDATE public.profiles SET role = 'admin' WHERE email = 'aumeeramyaaz@gmail.com';` — after that, use **Staff & Parents** (`/coach/staff`, admin-only) to invite or promote further coaches; no more manual SQL needed.

**RBAC notes (relevant to the dissertation writeup):**
- `profiles.role` is protected by a `BEFORE UPDATE` trigger (`protect_profile_role`, added in `schema_v3_additions.sql`) — a signed-in user cannot grant themselves a higher role by calling `supabase.from('profiles').update({ role: 'admin' })` directly; only an existing admin's update is honored. This closed a real self-escalation hole that existed in `schema_v2.sql`.
- Every `players`/`sessions`/`payments`/etc. RLS policy still grants identical power to any `coach`. `profiles.assigned_categories` (text[]) lets an admin scope a coach to specific categories from the Staff page. It's a UI-level convenience only, via `useScopedCategories()` (`src/hooks/useScopedCategories.ts`) — wired into **Players, Sessions (list + create), Attendance, Points (rules, global awards, player/session pickers), and Announcements** (filter chips/lists + narrowed "create" dropdowns, with "All" hidden once scoped). Every RLS policy still grants full access regardless of this field — promoting it to a real RLS boundary is future work, don't describe it as a security guarantee until it is one.
- `profiles.permissions` (text[], v4) narrows a specific **admin** account instead of all-or-nothing — see `src/lib/permissions.ts` for the area list (`finance`, `inventory`, `settings`, `staff`) and `hasPermission()`. Null/empty = unrestricted (the default — every admin created via the old manual-SQL bootstrap is unrestricted). Only an *unrestricted* admin can change anyone's `role` or `permissions` (enforced by the same `protect_profile_role` trigger, extended in v4) — a narrowed admin cannot grant itself more access. `coach` accounts are untouched by this; it's purely an admin-vs-admin mechanism, separate from `assigned_categories`. Enforced client-side via `usePermissionGuard(area)` at the top of each gated page (`settings`, `finance`, `expenses`, `income`, `inventory`, `staff`) plus a matching filter in both `Sidebar.tsx` and `MobileNav.tsx`.

---

## Key File Structure
```
src/
  app/
    (auth)/login, register, forgot-password
    coach/
      page.tsx              — Dashboard
      players/page.tsx      — Player list, category filter, Excel export, "Download All Cards" (bulk PDF)
      players/[id]/page.tsx — Player detail + stats editor + QR
      players/[id]/edit/    — Edit player + guardian
      players/new/          — Register new player (3-step)
      players/import/       — Bulk Excel import
      sessions/page.tsx     — Sessions list
      sessions/[id]/        — Session detail + attendance register
      sessions/new/         — Create session
      drills/               — Field Sheets: drill worksheets (roster + custom columns), fillable in-app, Excel + printable PDF export
      attendance/           — Attendance overview
      analytics/            — Analytics dashboard (charts)
      leaderboard/          — Points leaderboard
      points/               — Award points (rule-based batch + one-off custom) + manage rules
      payments/             — Fee tracking (By Player grid + full ledger, Record Payment modal)
      finance/              — Bird's-eye money dashboard: fees + income − expenses, trend chart
      income/               — Donations / sponsorships / fundraising income
      expenses/             — Club expenses (referee fees, transport, equipment, …)
      inventory/            — Kit/equipment tracking, low-stock alerts
      staff/                — Admin-only: invite/promote coaches, manage parent contacts
      announcements/        — Post/delete announcements
      settings/             — Club settings (logo, categories, fees) + Dropdown Lists (positions, guardian relationships, announcement tags, payment methods, expense/income/inventory categories, inventory conditions — every dropdown in the app that used to be hardcoded)
      profile/              — Coach profile
    parent/
      page.tsx              — Parent dashboard (incl. points total)
      card/                 — Pass card + Fan card
      schedule/             — Training schedule
      attendance/           — Attendance history + chart
      leaderboard/          — Club leaderboard (own player highlighted)
    player/
      page.tsx              — Player dashboard (incl. points total)
      card/                 — Player card view
      schedule/             — Schedule
      attendance/           — Attendance
      leaderboard/          — Club leaderboard (own player highlighted)
    scan/
      page.tsx              — QR scanner (requires login)
      live/page.tsx         — Live scanner (NO login, token-based)
    api/
      attendance/sync/      — Offline sync endpoint
      scan/verify/          — Live scanner token verification
      staff/invite/         — Admin-only: service-role invite (creates auth user + sets role)
  components/
    Leaderboard.tsx         — Shared leaderboard (used by coach/parent/player pages)
    layout/
      Sidebar.tsx           — Desktop sidebar nav
      MobileNav.tsx         — Mobile bottom nav
      CoachGuard.tsx        — Auth guard for coach pages
      ParentGuard.tsx       — Auth guard for parent pages
      PlayerGuard.tsx       — Auth guard for player pages
    cards/
      PassCard.tsx          — Club pass card (front + QR back) PDF — also reused off-screen for the bulk "Download All Cards" export
      FanCard.tsx           — Parent-customisable fan card
      PlayerCard.tsx        — FIFA-style card (kept for reference)
    charts/
      AttendanceChart.tsx   — Recharts bar chart
    scanner/
      QRScanner.tsx         — Camera QR scanner component
    ListEditor.tsx          — Reusable add/rename/remove chip list editor, used by every Dropdown Lists section in Club Settings
    PWAInit.tsx             — Registers service worker
  lib/
    supabase/
      client.ts             — Browser client (use everywhere)
      server.ts             — Server client (API routes only)
    permissions.ts          — PERMISSION_AREAS + hasPermission() for granular admin access (see RBAC notes)
  hooks/
    usePWA.ts               — Online/offline + install prompt
    useConfigList.ts         — Fetches one admin-configurable dropdown list from club_settings
    usePermissionGuard.ts    — Redirects a narrowed admin away from a page their `permissions` doesn't cover
  types/
    database.ts             — TypeScript types
  middleware.ts             — Minimal: no redirects, just passes through
public/
  sw.js                     — Service worker (PWA offline)
  manifest.json             — PWA manifest
  icon-192.png, icon-512.png
supabase/
  schema_v2.sql             — Base schema (already applied — run once on a fresh project)
  schema_v3_additions.sql   — Additive migration: money/inventory tables, RBAC fix, multi-category (run in Supabase SQL Editor)
  schema_v4_additions.sql   — Additive migration: frees position/tag/condition columns for Dropdown Lists, seeds them, adds profiles.permissions (run AFTER v3)
  schema_v5_additions.sql   — Additive migration: field_sheets table (run AFTER v4)
  schema_v6_additions.sql   — Additive migration: payments.reference, income.receipt_url, private `receipts` storage bucket, seeds categories/fees/club_info if missing (run AFTER v5)
```

---

## Database Tables
| Table | Purpose |
|---|---|
| `profiles` | Auth users + roles. `assigned_categories` (text[]) = soft coach scoping (see RBAC notes above) |
| `players` | Player records (player_code auto-generates as OPFC-001) |
| `guardians` | Parent/guardian linked to player (no unique constraint on player_id — always check-then-write, never upsert on it) |
| `player_stats` | Monthly ratings PAC/SHO/PAS/DRI/DEF/PHY + OVR (generated) |
| `training_sessions` | Sessions with scan_token for live scanner |
| `attendance` | QR scan records |
| `payments` | `type` in `entry` / `monthly` / `other`; has `method` column and an optional `reference` (bank transfer ref / Juice transaction ID / etc, freeform, never required). Entry-fee row auto-created (status `pending`) on player registration and import |
| `expenses` | Club spending: referee fees, transport, equipment, etc. `receipt_url` (optional) is an object path in the private `receipts` storage bucket, not a public URL — view via `ReceiptLink` (signed URL) |
| `income` | Donations, sponsorships, fundraising — anything that isn't a player fee. Same optional `receipt_url` convention as `expenses` |
| `inventory_items` | Kit/equipment: quantity, condition, `min_stock` drives the low-stock flag, optional `assigned_to` player |
| `announcements` | Club-wide messages |
| `club_settings` | Dynamic config: categories (plain string array, e.g. `["U9","U13"]` — never `{name: ...}` objects), fees, club_info (logo_url) |
| `point_rules` | Definable point-earning rules. `category` is `text[]` — always an array, e.g. `['All']` or `['U9','U13']` |
| `player_points` | Individual point awards — rule-based or one-off (`rule_id` null, `note` holds the reason) |
| `global_awards` | Club-wide point events. `target_category` is `text[]`, same convention as `point_rules.category` |
| `fan_card` | Parent-customisable card data |
| `field_sheets` | On-field drill worksheets. `columns` (jsonb `[{key,label}]`) + `player_ids` (uuid[], ordered) define the grid; `data` (jsonb, `{player_id: {col_key: value}}`) holds the filled-in cells — one row per sheet, not a normalized cell table |

---

## Current Known Issues / TODO
Also done since the last update: `assigned_categories` coach scoping now
extends beyond the Players list to Sessions (list + create), Attendance,
Points, and Announcements via the shared `useScopedCategories()` hook;
`MobileNav.tsx`'s bottom-nav icons are now filtered by `permissions`, same as
`Sidebar.tsx`; payments have an optional `reference` field (bank transfer
ref / Juice transaction ID / etc — never required, any method) shown in the
Record Payment modal, ledger, and Excel export; expenses and income both
support an optional receipt/attachment upload (private `receipts` storage
bucket, viewed via a short-lived signed URL through `ReceiptLink`); and the
production `club_settings` table (which had no `categories`/`fees`/`club_info`
rows at all) now has sane defaults seeded.

- [ ] `assigned_categories` coach scoping and `permissions` admin scoping are still a UI-level convenience, not an RLS boundary — every `players`/`sessions`/`payments`/etc. policy still grants full access to any `coach` regardless of `assigned_categories`. Promoting either to a real RLS boundary is future work — don't describe it as a security guarantee until it is one.
- [ ] Coach/parent invites need a real email provider configured in Supabase Auth (default SMTP is rate-limited) — see Deployment section. This needs a human decision (which provider — Resend/SendGrid/etc — and its API credentials), not something to pick unilaterally.
- [ ] No payment gateway yet (Stripe / MCB Juice) — payments are still manually recorded (now with an optional transaction reference field, see above, but no actual processing/reconciliation)

---

## How Parent Linking Works
1. Coach registers player + enters parent email in guardian info
2. Parent creates account at /register with same email
3. Coach opens player edit → saves → system auto-links profile_id + sets role to 'parent'
4. Parent logs in → sees their child

---

## Live Scanner (No Login)
Sessions can generate a `scan_token` (UUID stored in DB).
Share URL: `/scan/live?session=SESSION_ID&token=SCAN_TOKEN`
- Works on any device without login
- Validates token server-side in `/api/scan/verify`
- Auto-awards attendance points if "Attendance" rule exists
- Use kiosk mode on Android for a dedicated scanner device

---

## What To Work On Next
When I say "continue", pick up from the TODO list above.
Always run `npm run build` before `git push`.
Commit messages should be descriptive: `feat:`, `fix:`, `refactor:`.
