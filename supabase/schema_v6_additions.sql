-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v6 additions
-- Run in Supabase SQL Editor AFTER schema_v5_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
-- ══════════════════════════════════════════════════════════════

-- ── PAYMENTS: optional transaction reference ─────────────────────
-- Free-text field for a bank transfer ref / Juice transaction ID / cheque
-- number / etc. Always optional, regardless of payment method.
alter table public.payments add column if not exists reference text;

-- ── INCOME: receipt/attachment support (expenses already has this) ──
alter table public.income add column if not exists receipt_url text;

-- ── RECEIPTS STORAGE BUCKET ───────────────────────────────────────
-- Private (unlike 'avatars') since these are financial documents —
-- viewed via short-lived signed URLs, not a public link.
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "Coaches manage receipts" on storage.objects;
create policy "Coaches manage receipts" on storage.objects for all using (
  bucket_id = 'receipts' and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
) with check (
  bucket_id = 'receipts' and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);

-- ── SEED MISSING BASE CLUB SETTINGS ───────────────────────────────
-- categories/fees/club_info were never seeded on this project (only the
-- v4 dropdown-list keys were). Give the live site the same defaults the
-- Settings page already assumes client-side, so it isn't blank on first
-- load. No-op if these rows already exist.
insert into public.club_settings (key, value) values
  ('categories', '["U9","U13","First Team"]'::jsonb),
  ('fees', '{"entry":300,"monthly":{"U9":200,"U13":200,"First Team":200}}'::jsonb),
  ('club_info', '{"name":"Oasis Pailles Football Club","motto":"Omnis Tactus, Officium","location":"Morcellement Raffray, Pailles","logo_url":""}'::jsonb)
on conflict (key) do nothing;
