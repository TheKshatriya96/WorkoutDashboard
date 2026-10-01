create extension if not exists "pgcrypto";

create table if not exists public.workout_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_day text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null check (status in ('active', 'completed')),
  total_sets integer not null default 0,
  total_reps integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.set_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null references public.workout_sessions(id) on delete cascade,
  workout_day text not null,
  exercise_id text not null,
  exercise_name text not null,
  set_number integer not null,
  reps integer not null check (reps >= 0 and reps <= 200),
  prescribed_rest_seconds integer not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weight_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(5,2) not null check (weight_kg > 20 and weight_kg < 250),
  recorded_at timestamptz not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_sessions_user_started_idx on public.workout_sessions(user_id, started_at desc);
create index if not exists workout_sessions_user_day_idx on public.workout_sessions(user_id, workout_day);
create index if not exists set_logs_user_session_idx on public.set_logs(user_id, session_id);
create index if not exists set_logs_user_exercise_idx on public.set_logs(user_id, exercise_id, completed_at desc);
create index if not exists set_logs_user_completed_idx on public.set_logs(user_id, completed_at desc);
create index if not exists weight_logs_user_recorded_idx on public.weight_logs(user_id, recorded_at desc);
create index if not exists user_settings_user_idx on public.user_settings(user_id);

alter table public.workout_sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.user_settings enable row level security;

create policy "workout sessions are private" on public.workout_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "set logs are private" on public.set_logs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "weight logs are private" on public.weight_logs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "settings are private" on public.user_settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
