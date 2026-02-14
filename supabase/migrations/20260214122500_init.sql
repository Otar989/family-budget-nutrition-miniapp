create extension if not exists "pgcrypto";

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  age_group text not null check (age_group in ('adult', 'teen', 'child')),
  allergies text[] not null default '{}'
);

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  period text not null check (period in ('dinner', 'day', 'month')),
  budget numeric not null,
  total_estimated numeric not null,
  plan_payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  status text not null default 'draft',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.orders enable row level security;

create policy "allow anon read families" on public.families for select using (true);
create policy "allow anon write families" on public.families for insert with check (true);

create policy "allow anon read members" on public.family_members for select using (true);
create policy "allow anon write members" on public.family_members for insert with check (true);

create policy "allow anon read plans" on public.nutrition_plans for select using (true);
create policy "allow anon write plans" on public.nutrition_plans for insert with check (true);

create policy "allow anon read orders" on public.orders for select using (true);
create policy "allow anon write orders" on public.orders for insert with check (true);
