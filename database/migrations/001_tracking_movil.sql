-- Migración 001 · Seguimiento en vivo y notificaciones push (app móvil)
--
-- Aplícala sobre la base ya desplegada en Render:
--
--   psql "$DATABASE_URL" -f database/migrations/001_tracking_movil.sql
--
-- Todo es `if not exists`, así que volver a ejecutarla no rompe nada.
-- No modifica ni borra ninguna tabla existente.

begin;

create table if not exists route_sessions (
  id bigserial primary key,
  truck_id bigint not null references trucks(id),
  driver_id bigint not null references users(id),
  zone_id bigint references zones(id),
  status varchar(20) not null default 'activa',
  started_at timestamp not null default now(),
  finished_at timestamp,
  distance_m numeric(12, 2) not null default 0,
  positions_count integer not null default 0
);

create unique index if not exists route_sessions_one_active_per_truck
  on route_sessions (truck_id) where status = 'activa';

create index if not exists route_sessions_driver_idx on route_sessions (driver_id, started_at desc);

create table if not exists truck_positions (
  id bigserial primary key,
  session_id bigint not null references route_sessions(id) on delete cascade,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  accuracy_m numeric(8, 2),
  speed_mps numeric(8, 2),
  recorded_at timestamp not null default now()
);

create index if not exists truck_positions_session_idx on truck_positions (session_id, recorded_at desc);

create table if not exists push_tokens (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  token varchar(200) not null unique,
  platform varchar(20),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists push_tokens_user_idx on push_tokens (user_id);

create table if not exists user_locations (
  user_id bigint primary key references users(id) on delete cascade,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  accuracy_m numeric(8, 2),
  updated_at timestamp not null default now()
);

create table if not exists proximity_notices (
  id bigserial primary key,
  session_id bigint not null references route_sessions(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  distance_m numeric(10, 2) not null,
  sent_at timestamp not null default now(),
  unique (session_id, user_id)
);

commit;
