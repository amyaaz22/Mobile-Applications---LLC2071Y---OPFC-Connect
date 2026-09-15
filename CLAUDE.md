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
- **Before this deploys correctly, run `schema_v3_additions.sql` through `schema_v10_additions.sql` in the Supabase SQL Editor**, in order (all additive — safe on the live DB, and all already applied on the live project as of this writing). v3 adds expenses/income/inventory tables, fixes a profile role-escalation hole, widens payments.type, converts point_rules/global_awards category columns to arrays. v4 frees players.position / announcements.tag / inventory_items.condition from their old CHECK constraints (Club Settings → Dropdown Lists now owns those lists), seeds the new dropdown-list keys, and adds profiles.permissions for granular admin access. v5 adds the field_sheets table (Field Sheets feature). v6 adds payments.reference (optional transaction ref), income.receipt_url, a private `receipts` storage bucket for expense/income attachments, and seeds categories/fees/club_info if missing. v7 adds the `audit_log` table (Super Admin panel's Activity Log). v8 adds income.donor_profile_id (optional link from a donation to the parent who made it, for the Statement of Account). v9 extends `handle_new_user` to also log new signups into `audit_log` (self-registration doesn't go through the app's own `logAudit()`). v10 adds `players.enrollment_status` ('trial'|'active') for the trial-session onboarding flow.
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
- `profiles.assigned_categories` (text[]) is a separate, orthogonal mechanism: it scopes *which categories' data* a coach sees (via `useScopedCategories()`, `src/hooks/useScopedCategories.ts`) — wired into Players, Sessions (list + create), Attendance, Points, and Announcements (filter chips/lists + narrowed "create" dropdowns, "All" hidden once scoped). UI-level convenience only — every `players`/`sessions`/`payments`/etc. RLS policy still grants full data access to any `coach` regardless of this field. Promoting it to a real RLS boundary is future work.
- `profiles.permissions` (text[], v4, greatly expanded in v7) is granular **feature/page access control** — *which areas of the app* an account can reach at all — and, since v7, applies to **both `admin` and `coach`** accounts (originally admin-only). See `src/lib/permissions.ts` for the full area list (`PERMISSION_AREAS`, 16 areas — one per page/module: players, sessions, attendance, field_sheets, analytics, leaderboard, points, announcements, finance, payments, income, expenses, inventory, settings, staff, system) and `hasPermission()`. Null/empty = unrestricted (the default — every existing account, admin or coach, keeps full access until deliberately narrowed). `staff` and `system` are hard-locked to `role==='admin'` in `hasPermission()` regardless of the permissions list — a coach can never be granted staff management or the Super Admin panel. Only an *unrestricted admin* can change anyone's `role` or `permissions` at all — including narrowing a coach — enforced by the same `protect_profile_role` trigger (extended in v4); a narrowed account can never grant itself (or anyone) more access. Enforced client-side via `usePermissionGuard(area)` at the top of every gated page, plus a matching filter in both `Sidebar.tsx` and `MobileNav.tsx`.
  - **Self-lockout guard:** the Staff & Parents permission chips are disabled on the viewer's own row (`c.id === viewerId`), and `togglePermission()` itself refuses a self-target — an unrestricted admin narrowing *themselves* would otherwise instantly lock them out of Staff & Parents with no in-app recovery path (this happened once in production; recovered via direct Supabase access, see git history around the fix).
- **Activity log (`audit_log` table, v7):** append-only trail of significant actions (`src/lib/audit.ts`'s `logAudit()`), admin-only readable via RLS. Covers create/update/delete/invite/promote/demote/award across players, sessions, field sheets, point rules/awards, payments, expenses, income, inventory, announcements, settings, and staff changes. Deliberately *not* logged: individual QR attendance scans (already carry `scanned_by`/`scanned_at` on the row itself), Field Sheet per-cell autosaves, routine session status toggles, category-scope toggles, and one-off point-award deletions — kept out to avoid drowning the log in low-signal noise. Viewed in the **Super Admin** panel (`/coach/admin`, area `system`, admin-only) alongside an Accounts tab (every profile + `last_sign_in_at`/`email_confirmed_at` pulled from Supabase Auth via `/api/admin/users`, a service-role API route).

---

## Key File Structure
```
src/
  app/
    (auth)/login, register, forgot-password
    coach/
      page.tsx              — Dashboard
      players/page.tsx      — Player list, category filter, Excel export, "Download All Cards" (bulk PDF), "Trial" badge for trial players
      players/[id]/page.tsx — Player detail + stats editor + QR + "Convert to Full Member" banner for trial players
      players/[id]/edit/    — Edit player + guardian
      players/new/          — Register new player (3-step) — optional "trial session" checkbox skips the entry fee until converted
      players/import/       — Bulk Excel import, optional Photo URL column (direct image link or Google Drive share link — auto-converted, fetched, and re-uploaded like a normal photo upload)
      sessions/page.tsx     — Sessions list
      sessions/[id]/        — Session detail + attendance register
      sessions/new/         — Create session
      drills/               — Field Sheets: drill worksheets (roster + custom columns), fillable in-app, Excel + printable PDF export
      attendance/           — Attendance overview
      analytics/            — Analytics dashboard (charts)
      leaderboard/          — Points leaderboard
      points/               — Award points (rule-based batch + one-off custom) + manage rules
      payments/             — Fee tracking (By Player grid + full ledger, Record Payment modal — status can be Paid/Pending/Overdue, and the month picker lets you create a standalone due for any past month)
      finance/              — Bird's-eye money dashboard: fees + income − expenses, trend chart
      income/               — Donations / sponsorships / fundraising income
      expenses/             — Club expenses (referee fees, transport, equipment, …)
      inventory/            — Kit/equipment tracking, low-stock alerts
      staff/                — Admin-only: invite/promote coaches, manage parent contacts, granular permission chips per coach/admin, "Export Contacts" (.vcf) for bulk-importing parent numbers into coaching staff phones
      announcements/        — Post/delete announcements
      settings/             — Club settings (logo, categories, fees) + Dropdown Lists (positions, guardian relationships, announcement tags, payment methods, expense/income/inventory categories, inventory conditions — every dropdown in the app that used to be hardcoded)
      admin/                — Super Admin panel (area 'system', admin-only): Accounts tab (every profile + last sign-in/email-confirmed from Supabase Auth) + Activity Log tab (audit_log, filterable by entity)
      profile/              — Coach profile
    parent/
      page.tsx              — Parent dashboard (incl. points total)
      card/                 — Pass card + Fan card
      schedule/             — Training schedule
      attendance/           — Attendance history + chart
      leaderboard/          — Club leaderboard (own player highlighted)
      statement/            — Statement of Account: outstanding balance, all payments (entry/monthly/other) for their child, their own linked donations, Excel export
    player/
      page.tsx              — Player dashboard (incl. points total)
      card/                 — Player card view
      schedule/             — Schedule
      attendance/           — Attendance
      leaderboard/          — Club leaderboard (own player highlighted)
    scan/
      page.tsx              — QR scanner (requires login). Caches the session list + active roster to localStorage on every successful online load and falls back to that cache when offline — the service worker deliberately never caches supabase.co requests, so without this the session picker (and player lookup during a scan) went permanently blank with no connectivity
      live/page.tsx         — Live scanner (NO login, token-based) — note: does not yet have the same offline cache fallback as page.tsx above
    api/
      attendance/sync/      — Offline sync endpoint
      scan/verify/          — Live scanner token verification
      staff/invite/         — Admin-only: service-role invite (creates auth user + sets role)
      admin/users/           — area 'system'-only: service-role account list (profiles + Supabase Auth last_sign_in_at/email_confirmed_at)
  components/
    Leaderboard.tsx         — Shared leaderboard (used by coach/parent/player pages)
    ReceiptLink.tsx         — Opens an expense/income receipt via a short-lived signed URL (private `receipts` bucket)
    layout/
      Sidebar.tsx           — Desktop sidebar nav, filters every item by hasPermission() (admin AND coach)
      MobileNav.tsx         — Mobile bottom nav, same filtering
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
    permissions.ts          — PERMISSION_AREAS (16 areas) + hasPermission() for admin AND coach granular access (see RBAC notes)
    audit.ts                — logAudit() — fire-and-forget insert into audit_log, used across most mutating actions
  hooks/
    usePWA.ts               — Online/offline + install prompt
    useConfigList.ts         — Fetches one admin-configurable dropdown list from club_settings
    useScopedCategories.ts   — assigned_categories UI scoping (visibleCategories/scopedCategories/inScope)
    usePermissionGuard.ts    — Redirects an account (admin or coach) away from a page their `permissions` doesn't cover
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
  schema_v7_additions.sql   — Additive migration: audit_log table (append-only, admin-only read) for the Super Admin panel's Activity Log (run AFTER v6)
  schema_v8_additions.sql   — Additive migration: income.donor_profile_id, optional link from a donation to the parent's account (run AFTER v7)
  schema_v9_additions.sql   — Additive migration: handle_new_user also logs new signups into audit_log (run AFTER v8)
  schema_v10_additions.sql  — Additive migration: players.enrollment_status ('trial'|'active') for trial-session onboarding (run AFTER v9)
```

---

## Database Tables
| Table | Purpose |
|---|---|
| `profiles` | Auth users + roles. `assigned_categories` (text[]) = soft coach scoping (see RBAC notes above) |
| `players` | Player records (player_code auto-generates as OPFC-001). `enrollment_status` (v10, `'trial'|'active'`, default `'active'`) — a trial player skips the auto-created entry fee until converted from their detail page (see Key File Structure) |
| `guardians` | Parent/guardian linked to player (no unique constraint on player_id — always check-then-write, never upsert on it) |
| `player_stats` | Monthly ratings PAC/SHO/PAS/DRI/DEF/PHY + OVR (generated) |
| `training_sessions` | Sessions with scan_token for live scanner |
| `attendance` | QR scan records |
| `payments` | `type` in `entry` / `monthly` / `other`; has `method` column and an optional `reference` (bank transfer ref / Juice transaction ID / etc, freeform, never required). Entry-fee row auto-created (status `pending`) on player registration and import |
| `expenses` | Club spending: referee fees, transport, equipment, etc. `receipt_url` (optional) is an object path in the private `receipts` storage bucket, not a public URL — view via `ReceiptLink` (signed URL) |
| `income` | Donations, sponsorships, fundraising — anything that isn't a player fee. Same optional `receipt_url` convention as `expenses`. `donor_profile_id` (v8, optional) links a donation to the parent's account so it shows on their Statement of Account — set via a select in the Record Income form when a parent profile exists |
| `inventory_items` | Kit/equipment: quantity, condition, `min_stock` drives the low-stock flag, optional `assigned_to` player |
| `announcements` | Club-wide messages |
| `club_settings` | Dynamic config: categories (plain string array, e.g. `["U9","U13"]` — never `{name: ...}` objects), fees, club_info (logo_url) |
| `point_rules` | Definable point-earning rules. `category` is `text[]` — always an array, e.g. `['All']` or `['U9','U13']` |
| `player_points` | Individual point awards — rule-based or one-off (`rule_id` null, `note` holds the reason) |
| `global_awards` | Club-wide point events. `target_category` is `text[]`, same convention as `point_rules.category` |
| `fan_card` | Parent-customisable card data |
| `field_sheets` | On-field drill worksheets. `columns` (jsonb `[{key,label}]`) + `player_ids` (uuid[], ordered) define the grid; `data` (jsonb, `{player_id: {col_key: value}}`) holds the filled-in cells — one row per sheet, not a normalized cell table |
| `audit_log` | Append-only activity trail for the Super Admin panel. `actor_id`/`actor_name`/`actor_role`, `action` (create/update/delete/invite/promote/demote/award), `entity` (…/`account` for new signups, logged directly by the `handle_new_user` trigger since self-registration never goes through the app's `logAudit()`) + `entity_id`, human-readable `summary`, optional `metadata` jsonb. Admin-only read via RLS; any coach/admin (or the trigger, running as a security-definer function) can insert |

---

## Current Known Issues / TODO
Also done since the last update: the Record Payment modal now has an
**Overdue** status option (alongside Paid/Pending) — combined with the
existing free month picker, this is how you create a standalone
past-due for a specific player and month (e.g. September ended unpaid);
the **QR scanner** (`/scan`) now caches the session list and active
roster to `localStorage` on every successful online load and falls back
to that cache when offline, fixing a real bug where the session picker
(and player lookup mid-scan) went permanently blank with zero
connectivity at the field — `/scan/live` (the no-login link-based
scanner) doesn't have this fallback yet; new account signups (via
`/register` or an invite) are now logged into `audit_log` automatically
by the `handle_new_user` trigger, and the Super Admin Accounts tab
flags accounts created in the last 7 days with a **New** badge — a true
push/email notification the instant someone signs up still needs the
Brevo SMTP/API setup to land first (see below), so this is in-app
visibility only for now, not a ping to your phone; bulk player import
(`players/import`) now accepts an optional **Photo URL** column — a
direct image link or a Google Form/Sheets-collected Google Drive share
link (auto-converted to a fetchable direct-view URL) — the photo is
downloaded and re-uploaded into the same storage bucket a manual photo
upload uses, falling back to storing the raw URL if the fetch is
CORS-blocked; Staff & Parents has an **Export Contacts** button that
downloads a standard `.vcf` file (`OPFC - <Guardian Name> (<Relationship>
of <Player Name>)`, Mauritius numbers auto-prefixed `+230`) for bulk-importing
every parent's number into coaching staff phones in one go; and players
can now be registered as a **trial** (`enrollment_status`) — no entry fee
charged, badged in the Players list, with a **Convert to Full Member**
button on their detail page that flips them to active and creates the
entry fee at that point, matching the club's real trial-session-then-
official-onboarding workflow.

Previously: parents now have a **Statement of Account**
(`/parent/statement`) — outstanding balance, total paid, total contributed,
and a chronological transaction list covering entry fee, monthly fees, and
any "other" payments for their linked player, plus their own donations
(when a coach links a donation to their account via the new optional
`donor_profile_id` on `income`, set from a dropdown in the Record Income
form). Excel export included; linked from the parent dashboard's Fee Status
card and the parent Sidebar. Granular `permissions` now covers 16
areas (one per page/module) instead of the original 4, and — the big
change — applies to **`coach` accounts too**, not just admin-narrowing;
every previously-ungated coach page now sits behind `usePermissionGuard`;
Staff & Parents has a matching permission-chip editor for coach rows
(with `staff`/`system` hard-excluded, since those stay admin-only no
matter what); a new **Super Admin panel** (`/coach/admin`, area
`system`) shows every account's role/permissions/assigned-categories
plus last sign-in and email-confirmed status (via Supabase Auth), and a
filterable **Activity Log** backed by the new `audit_log` table — most
create/update/delete/invite/promote/demote/award actions across the app
are now logged; `assigned_categories` coach scoping now extends beyond
the Players list to Sessions (list + create), Attendance, Points, and
Announcements via the shared `useScopedCategories()` hook; payments have
an optional `reference` field (bank transfer ref / Juice transaction ID
/ etc — never required, any method); expenses and income both support an
optional receipt/attachment upload (private `receipts` storage bucket,
viewed via a short-lived signed URL through `ReceiptLink`); and the
production `club_settings` table (which had no `categories`/`fees`/
`club_info` rows at all) now has sane defaults seeded. Also fixed: an
unrestricted admin could narrow their own `permissions` via the Staff
page and instantly lock themselves out with no in-app recovery path —
the chips (and `togglePermission()` itself) now refuse a self-target.

- [ ] `assigned_categories` coach scoping and `permissions` access control are still a UI-level convenience, not an RLS boundary — every `players`/`sessions`/`payments`/etc. policy still grants full data access to any `coach` regardless of either field. Promoting either to a real RLS boundary is future work — don't describe it as a security guarantee until it is one.
- [ ] Coach/parent invites need a real email provider configured in Supabase Auth (default SMTP is rate-limited) — see Deployment section. Decided: Brevo (free forever, 300 emails/day, no custom domain required — verify a single sender email instead of DNS). Still needs the actual account + SMTP key entered into Supabase Auth → SMTP Settings.
- [ ] No payment gateway yet (Stripe / MCB Juice) — payments are still manually recorded (now with an optional transaction reference field, see above, but no actual processing/reconciliation)
- [ ] Audit logging deliberately skips some routine/high-volume actions (QR attendance scans, Field Sheet cell autosaves, session status toggles, category-scope toggles, one-off point-award deletions, player stat edits) — extend `logAudit()` coverage if any of these turn out to need a trail too
- [ ] `/scan/live` (the no-login, link-based scanner) doesn't have the same offline localStorage cache fallback `/scan` now has — still needs live network to validate the token and load the roster
- [ ] New-account visibility is in-app only (Super Admin panel's "New" badge + Activity Log) — a real push/email ping to the admin the instant someone registers needs the Brevo SMTP/API setup finished first, then either a Supabase Database Webhook or scheduled check calling a transactional email API (SMTP alone, once configured, only covers Supabase Auth's own templates — invite/confirm/reset — not custom "notify the admin" emails)

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
