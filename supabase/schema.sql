-- CARGA · esquema para Supabase
-- Pegar y correr completo en el SQL Editor del proyecto.

create extension if not exists "pgcrypto";

-- Espacios de rutina (antes "Día 1", "Día 2 - Tren superior", etc.)
create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Ejercicios dentro de un espacio
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,
  name text not null,
  equipment text not null default 'barra', -- barra | mancuernas | kettlebell | polea | peso corporal
  bar_weight numeric,                       -- solo aplica si equipment = 'barra' (45 o 35 lb)
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Series/rondas registradas. exercise_name queda duplicado a propósito:
-- permite comparar el mismo ejercicio entre distintos espacios (historial cruzado)
-- sin tener que hacer joins por nombre normalizado.
create table if not exists set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  exercise_name text not null,
  rounds int not null default 1,
  reps int not null default 0,
  weight numeric not null default 0,
  logged_at timestamptz not null default now()
);

-- Fecha de inicio del ciclo de 3 semanas (una fila por usuario)
create table if not exists cycle_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  cycle_start date not null default current_date,
  cycle_length_weeks int not null default 3
);

alter table spaces enable row level security;
alter table exercises enable row level security;
alter table set_logs enable row level security;
alter table cycle_settings enable row level security;

create policy "own spaces" on spaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own exercises" on exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own set_logs" on set_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own cycle_settings" on cycle_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_exercises_space on exercises(space_id);
create index if not exists idx_set_logs_exercise on set_logs(exercise_id);
create index if not exists idx_set_logs_name on set_logs(user_id, exercise_name);

-- RLS restringe filas, pero el rol `authenticated` también necesita permiso
-- de tabla a nivel Postgres. Al crear tablas por SQL directo (no por la UI
-- de Supabase) este grant no se aplica solo, así que lo hacemos explícito.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.spaces to authenticated;
grant select, insert, update, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.set_logs to authenticated;
grant select, insert, update, delete on public.cycle_settings to authenticated;
