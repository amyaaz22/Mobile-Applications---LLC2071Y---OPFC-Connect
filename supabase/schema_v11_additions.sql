-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v11 additions
-- Run in Supabase SQL Editor AFTER schema_v10_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
--
-- Fixes two confirmed bugs found during an internal audit:
-- ══════════════════════════════════════════════════════════════

-- ── FIX: invited coaches/parents silently stayed role='parent' ───
-- protect_profile_role's authorization check is keyed off auth.uid(),
-- which is NULL for requests made with the service-role key (no user JWT
-- — this is standard Supabase behavior, not a bug in the key itself).
-- /api/staff/invite's role-setting update runs via the service-role
-- client (src/lib/supabase/server.ts createAdminClient()), so that
-- update was being silently reverted back to the handle_new_user default
-- ('parent') every time — confirmed against production: newly-invited
-- accounts required a manual second "Promote" from Staff & Parents to
-- actually take effect. auth.role() = 'service_role' is the standard
-- Supabase way to recognize this — it's a real trust boundary: the
-- service-role key is a server-only secret, used by exactly two vetted
-- routes (staff/invite, admin/users) whose own authorization checks
-- already ran before touching this client.
create or replace function public.protect_profile_role() returns trigger as $$
begin
  if new.role is distinct from old.role or new.permissions is distinct from old.permissions then
    if auth.role() <> 'service_role' and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
        and (p.permissions is null or array_length(p.permissions, 1) is null)
    ) then
      new.role := old.role;
      new.permissions := old.permissions;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ── FIX: parents could never see their own linked donations ──────
-- income.donor_profile_id (v8) had no RLS SELECT policy allowing the
-- donating parent to read their own row — only the blanket "Coaches
-- manage income" (admin/coach) policy existed, so the Statement of
-- Account's donor_profile_id query was silently returning zero rows
-- for every parent, no error shown.
drop policy if exists "Parents view own linked donations" on public.income;
create policy "Parents view own linked donations" on public.income for select using (
  donor_profile_id = auth.uid()
);
