create table if not exists public.telegram_users (
  telegram_id bigint primary key,
  username text,
  first_name text not null,
  last_name text,
  language_code text,
  photo_url text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

alter table public.telegram_users enable row level security;

create policy "allow anon read telegram users" on public.telegram_users for select using (true);
create policy "allow anon write telegram users" on public.telegram_users for insert with check (true);
create policy "allow anon update telegram users" on public.telegram_users for update using (true) with check (true);
