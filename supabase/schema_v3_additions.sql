-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v3 additions
-- Run in Supabase SQL Editor AFTER schema_v2.sql has already been applied.
-- Additive only — safe to run on the live production database.
-- ══════════════════════════════════════════════════════════════

-- ── SECURITY FIX: profiles.role could be self-escalated ─────────
-- Today "Users can update own profile" has no column restriction, so any
-- signed-in user (parent/player) can call
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)
-- directly and grant themselves admin/coach access. This trigger silently
-- reverts a role change unless the person making the change is already an
-- admin. Self-editing name/avatar/etc is untouched.
create or replace function public.protect_profile_role() returns trigger as $$
begin
  if new.role is distinct from old.role then
    if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger before update on public.profiles
  for each row execute function protect_profile_role();

-- Let admins update any profile (promote/demote coaches, assign categories).
-- Combined with the trigger above: a non-admin still can't grant themselves
-- this policy's power because they can't get role='admin' in the first place.
drop policy if exists "Admins manage all profiles" on public.profiles;
create policy "Admins manage all profiles" on public.profiles for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Optional soft scoping: categories a coach is limited to in the UI.
-- Null/empty = unrestricted (all current admins/coaches). This is a UI-level
-- filter for now, not an RLS boundary — every players/sessions/payments
-- policy still grants any 'coach' full table access. Documented so it's
-- never mistaken for a hard security guarantee.
alter table public.profiles add column if not exists assigned_categories text[];

-- ── CATEGORIES SEED FIX ──────────────────────────────────────────
-- The v2 seed inserted categories as objects ({"name": "..."}) but every
-- screen in the app (Club Settings, players, leaderboard, etc.) reads
-- club_settings.categories as a plain string array. Only fixes a *fresh*
-- install — your live categories were already overwritten in the correct
-- shape the first time someone saved Club Settings, so this is a no-op there.
update public.club_settings
  set value = '["U9","U13","First Team"]'::jsonb
  where key = 'categories' and jsonb_typeof(value) = 'array'
    and jsonb_typeof(value->0) = 'object';

-- ── POINT RULES / GLOBAL AWARDS: multi-category targeting ───────
alter table public.point_rules alter column category drop default;
alter table public.point_rules alter column category type text[] using (
  case when category is null or category = 'All' then array['All'] else array[category] end
);
alter table public.point_rules alter column category set default array['All'];

alter table public.global_awards alter column target_category type text[] using (
  case when target_category is null or target_category = 'All' then array['All'] else array[target_category] end
);
alter table public.global_awards alter column target_category set default array['All'];

-- ── PAYMENTS: flexible types + method ────────────────────────────
alter table public.payments drop constraint if exists payments_type_check;
alter table public.payments add constraint payments_type_check check (type in ('entry','monthly','other'));
alter table public.payments add column if not exists method text;

-- ── EXPENSES ──────────────────────────────────────────────────────
create table if not exists public.expenses (
  id           uuid primary key default uuid_generate_v4(),
  date         date not null default current_date,
  category     text not null default 'Other',
  description  text not null,
  amount       integer not null check (amount > 0),
  paid_by      text,
  receipt_url  text,
  notes        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz default now()
);
alter table public.expenses enable row level security;
drop policy if exists "Coaches manage expenses" on public.expenses;
create policy "Coaches manage expenses" on public.expenses for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);

-- ── INCOME / DONATIONS ───────────────────────────────────────────
create table if not exists public.income (
  id           uuid primary key default uuid_generate_v4(),
  date         date not null default current_date,
  source       text not null default 'Donation',
  donor_name   text,
  amount       integer not null check (amount > 0),
  category     text,
  notes        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz default now()
);
alter table public.income enable row level security;
drop policy if exists "Coaches manage income" on public.income;
create policy "Coaches manage income" on public.income for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);

-- ── INVENTORY ─────────────────────────────────────────────────────
create table if not exists public.inventory_items (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  category     text not null default 'Other',
  quantity     integer not null default 0,
  condition    text default 'Good' check (condition in ('New','Good','Worn','Damaged')),
  location     text,
  assigned_to  uuid references public.players(id) on delete set null,
  min_stock    integer default 0,
  notes        text,
  updated_at   timestamptz default now(),
  created_at   timestamptz default now()
);
alter table public.inventory_items enable row level security;
drop policy if exists "Coaches manage inventory" on public.inventory_items;
create policy "Coaches manage inventory" on public.inventory_items for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
drop trigger if exists inventory_updated_at on public.inventory_items;
create trigger inventory_updated_at before update on public.inventory_items
  for each row execute function update_updated_at();
