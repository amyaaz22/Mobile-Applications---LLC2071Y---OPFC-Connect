# OPFC Connect — Academy Management System

**Oasis Pailles Football Club** · Morcellement Raffray, Pailles, Mauritius

## Tech Stack
- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Postgres DB + Auth + Storage)
- **Tailwind CSS** (custom navy/teal theme)
- **Vercel** (hosting, free tier)

---

## Deploy in 5 Steps

### Step 1 — Create Supabase project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `opfc-connect`, choose a strong password, region: closest to Mauritius
3. Once created: Settings → API → copy **Project URL** and **anon public** key
4. Go to SQL Editor → New query → paste entire contents of `supabase/schema.sql` → Run

### Step 2 — Create Vercel project
1. Go to [vercel.com](https://vercel.com) → Add New → Project
2. Import from GitHub (push this folder to GitHub first, or drag & drop)
3. Framework: **Next.js** (auto-detected)

### Step 3 — Add environment variables in Vercel
In your Vercel project → Settings → Environment Variables, add:
```
NEXT_PUBLIC_SUPABASE_URL        = your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   = your Supabase anon key
SUPABASE_SERVICE_ROLE_KEY       = your Supabase service role key (Settings → API)
```

### Step 4 — Deploy
```bash
# Install dependencies
npm install

# Test locally
npm run dev

# Deploy to Vercel
npx vercel --prod
```

### Step 5 — Create your admin account
1. Go to your deployed app → Sign up with your coach email
2. In Supabase SQL Editor run:
```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
```

---

## Features

### Coach / Admin
- ✅ Player management (add, view, edit)
- ✅ FIFA-style player card with 6 stats (PAC/SHO/PAS/DRI/DEF/PHY)
- ✅ Monthly stats editor with sliders
- ✅ Download player card as PDF
- ✅ QR attendance scanner (mobile-first, works on any phone)
- ✅ Attendance card generator with unique QR per player
- ✅ Session management (training / match / tournament)
- ✅ Payment tracker (monthly fees + entry fee)
- ✅ Club announcements (by category)
- ✅ Dashboard with live stats

### Parent Portal
- ✅ Their child's player card (live, view only)
- ✅ Upcoming training schedule (filtered to their category)
- ✅ Attendance history
- ✅ Fee status
- ✅ Club announcements

### Player Portal
- ✅ Own player card (live, view only)
- ✅ Schedule, attendance, announcements

---

## Fee Structure
| Category | Monthly | Entry (one-time) |
|----------|---------|------------------|
| U9 | Rs 100 | Rs 500 |
| U13 | Rs 150 | Rs 500 |
| First Team | Rs 200 | Rs 500 |

---

## Adding a Parent Account
1. Create their account: coach registers them in Supabase or they sign up
2. In SQL: `UPDATE profiles SET role = 'parent' WHERE email = 'parent@email.mu';`
3. Link to player: `INSERT INTO guardians (player_id, profile_id, ...) VALUES (...)`

Or build an invite flow (Phase 2).

---

## Phase 2 Roadmap
- [ ] Payment gateway (Stripe or MCB Juice)
- [ ] Email notifications on card update
- [ ] WhatsApp notification via Twilio
- [ ] Google Drive card export (auto-backup)
- [ ] Photo upload for player profiles
- [ ] Parent self-registration with invite link
- [ ] Injury tracking
- [ ] Match results & league table

---

*Omnis Tactus, Officium*
