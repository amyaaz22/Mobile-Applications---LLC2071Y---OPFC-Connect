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
| `admin` | Everything | /coach/* |
| `coach` | Their group + club data | /coach/* |
| `parent` | Their child only | /parent/* |
| `player` | Their own data | /player/* |

**To set admin:** `UPDATE public.profiles SET role = 'admin' WHERE email = 'aumeeramyaaz@gmail.com';`

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
      points/               — Award points + manage rules
      payments/             — Fee tracking
      announcements/        — Post/delete announcements
      settings/             — Club settings (logo, categories, fees)
      profile/              — Coach profile
    parent/
      page.tsx              — Parent dashboard
      card/                 — Pass card + Fan card
      schedule/             — Training schedule
      attendance/           — Attendance history + chart
    player/
      page.tsx              — Player dashboard
      card/                 — Player card view
      schedule/             — Schedule
      attendance/           — Attendance
    scan/
      page.tsx              — QR scanner (requires login)
      live/page.tsx         — Live scanner (NO login, token-based)
    api/
      attendance/sync/      — Offline sync endpoint
      scan/verify/          — Live scanner token verification
  components/
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
  schema_v2.sql             — Full schema (run in Supabase SQL Editor)
```

---

## Database Tables
| Table | Purpose |
|---|---|
| `profiles` | Auth users + roles |
| `players` | Player records (player_code auto-generates as OPFC-001) |
| `guardians` | Parent/guardian linked to player |
| `player_stats` | Monthly ratings PAC/SHO/PAS/DRI/DEF/PHY + OVR (generated) |
| `training_sessions` | Sessions with scan_token for live scanner |
| `attendance` | QR scan records |
| `payments` | Entry + monthly fees |
| `announcements` | Club-wide messages |
| `club_settings` | Dynamic config: categories, fees, club_info (logo_url) |
| `point_rules` | Definable point-earning rules |
| `player_points` | Individual point awards |
| `global_awards` | Club-wide point events |
| `fan_card` | Parent-customisable card data |

---

## Current Known Issues / TODO
- [ ] Categories in new/edit player forms are still hardcoded — should fetch from club_settings
- [ ] Pass card should show guardian phone number (not category or nationality)
- [ ] Logo from club_settings should be used on PassCard and everywhere
- [ ] Player import: categories should validate against club_settings dynamically
- [ ] Export players to Excel (same format as import template)
- [ ] Session detail page: add "Generate Scanner Link" button (creates scan_token, shows shareable URL)
- [ ] Leaderboard visible to parents/players in their portal
- [ ] Points shown on player/parent dashboard
- [ ] CoachGuard/ParentGuard/PlayerGuard files may not exist in this deployment — check and recreate if missing

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
