-- ============================================================
-- BITÁCORA FAMILIAR — Supabase Schema
-- Ejecuta esto en el SQL Editor de tu proyecto Supabase
-- ============================================================

-- 1. Perfiles (usuarios de la familia)
create table if not exists profiles (
  id         uuid    default gen_random_uuid() primary key,
  name       text    unique not null,
  password   text    not null,
  avatar     text    not null default '🏠',
  role       text    not null default 'user' check (role in ('admin','user')),
  created_at timestamptz default now()
);

-- 2. Entradas de limpieza
create table if not exists entries (
  id           uuid    default gen_random_uuid() primary key,
  user_id      uuid    not null references profiles(id) on delete cascade,
  date         date    not null,
  week         integer not null,
  year         integer not null,
  general_note text,
  created_at   timestamptz default now()
);

-- 3. Tareas de cada entrada
create table if not exists entry_tasks (
  id              uuid    default gen_random_uuid() primary key,
  entry_id        uuid    not null references entries(id) on delete cascade,
  task_id         text    not null,
  label           text    not null,
  icon            text    not null,
  completed       boolean not null default false,
  note            text,
  photo_url       text,
  elmira_approves boolean not null default false
);

-- ── Índices útiles ───────────────────────────────────────────
create index if not exists idx_entries_user   on entries(user_id);
create index if not exists idx_entries_date   on entries(date);
create index if not exists idx_tasks_entry    on entry_tasks(entry_id);

-- ── RLS (Row Level Security) — desactivado para app familiar ─
-- Si quieres activarlo en el futuro, activa aquí:
-- alter table profiles    enable row level security;
-- alter table entries     enable row level security;
-- alter table entry_tasks enable row level security;

-- ── Storage bucket para fotos ────────────────────────────────
-- Ejecuta esto también en el SQL Editor:
insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', true)
on conflict do nothing;

-- Política pública de lectura para el bucket
create policy "Evidencias públicas" on storage.objects
  for select using (bucket_id = 'evidencias');

create policy "Subir evidencias" on storage.objects
  for insert with check (bucket_id = 'evidencias');

create policy "Borrar evidencias" on storage.objects
  for delete using (bucket_id = 'evidencias');
