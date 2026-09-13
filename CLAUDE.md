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
- **Before this deploys correctly, run `supabase/schema_v3_additions.sql` in the Supabase SQL Editor** (additive — safe on the live DB, adds expenses/income/inventory tables, fixes a profile role-escalation hole, widens payments.type, converts point_rules/global_awards category columns to arrays)
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
- Every `players`/`sessions`/`payments`/etc. RLS policy still grants identical power to any `coach`. `profiles.assigned_categories` (text[]) lets an admin scope a coach to specific categories from the Staff page. It's wired into the **Players list** (filter chips + query) as a UI-level convenience only — every other coach-facing screen and every RLS policy still grants full access regardless of this field. Extending the same filter elsewhere, or promoting it to a real RLS boundary, is future work — don't describe it as a security guarantee until it is one.

---

## Key File Structure
```
src/
  app/
    (auth)/login, register, forgot-password
    coach/
      page.tsx              — Dashboard
      players/page.tsx      — Player list
      players/[id]/page.tsx — Player detail + stats editor + QR
      players/[id]/edit/    — Edit player + guardian
      players/new/          — Register new player (3-step)
      players/import/       — Bulk Excel import
      sessions/page.tsx     — Sessions list
      sessions/[id]/        — Session detail + attendance register
      sessions/new/         — Create session
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
      settings/             — Club settings (logo, categories, fees)
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
      PassCard.tsx          — Club pass card (front + QR back) PDF
      FanCard.tsx           — Parent-customisable fan card
      PlayerCard.tsx        — FIFA-style card (kept for reference)
    charts/
      AttendanceChart.tsx   — Recharts bar chart
    scanner/
      QRScanner.tsx         — Camera QR scanner component
    PWAInit.tsx             — Registers service worker
  lib/supabase/
    client.ts               — Browser client (use everywhere)
    server.ts               — Server client (API routes only)
  hooks/
    usePWA.ts               — Online/offline + install prompt
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
| `payments` | `type` in `entry` / `monthly` / `other`; has `method` column. Entry-fee row auto-created (status `pending`) on player registration and import |
| `expenses` | Club spending: referee fees, transport, equipment, etc. |
| `income` | Donations, sponsorships, fundraising — anything that isn't a player fee |
| `inventory_items` | Kit/equipment: quantity, condition, `min_stock` drives the low-stock flag, optional `assigned_to` player |
| `announcements` | Club-wide messages |
| `club_settings` | Dynamic config: categories (plain string array, e.g. `["U9","U13"]` — never `{name: ...}` objects), fees, club_info (logo_url) |
| `point_rules` | Definable point-earning rules. `category` is `text[]` — always an array, e.g. `['All']` or `['U9','U13']` |
| `player_points` | Individual point awards — rule-based or one-off (`rule_id` null, `note` holds the reason) |
| `global_awards` | Club-wide point events. `target_category` is `text[]`, same convention as `point_rules.category` |
| `fan_card` | Parent-customisable card data |

---

## Current Known Issues / TODO
Everything from the previous list (dynamic categories, pass card guardian phone,
logo everywhere, players export, scanner link, leaderboard + points for
parents/players) is done. Also done in this pass: full payments rebuild
(entry fees, Record Payment, ledger + export), points rework (custom
one-off awards, per-player history, multi-category rule targeting),
Expenses/Income/Inventory modules, and the Staff & Parents admin page
(invite/promote coaches, manage parent contacts, import/export both).

- [ ] `assigned_categories` coach scoping is only wired into the Players list — extend to Sessions, Payments, Points if per-coach scoping needs to feel consistent, or promote it to a real RLS boundary if it needs to be a hard guarantee
- [ ] Expense/inventory categories are fixed lists in code (not in Club Settings like player categories) — move to `club_settings` if the club wants to customize them without a code change
- [ ] Coach/parent invites need a real email provider configured in Supabase Auth (default SMTP is rate-limited) — see Deployment section
- [ ] No payment gateway yet (Stripe / MCB Juice) — payments are still manually recorded
- [ ] `expenses`/`income` have no receipt/attachment upload yet (`receipt_url` column exists on `expenses`, unused)

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
