create table if not exists zones (
  id bigserial primary key,
  name varchar(120) not null unique,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  criticality varchar(40) not null default 'Media'
);

create table if not exists users (
  id bigserial primary key,
  name varchar(120) not null,
  email varchar(160) not null unique,
  role varchar(40) not null,
  zone varchar(120) not null,
  password_hash varchar(255) not null,
  created_at timestamp not null default now()
);

create table if not exists schedules (
  id bigserial primary key,
  zone_id bigint not null references zones(id),
  day varchar(120) not null,
  time varchar(80) not null,
  waste varchar(120) not null
);

create table if not exists trucks (
  id bigserial primary key,
  code varchar(20) not null unique,
  driver varchar(120) not null,
  status varchar(60) not null,
  zone_id bigint not null references zones(id),
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null
);

create table if not exists routes (
  id bigserial primary key,
  truck_id bigint not null references trucks(id),
  zone_id bigint not null references zones(id),
  progress integer not null check (progress between 0 and 100),
  eta varchar(40) not null,
  delay varchar(80) not null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null
);

create table if not exists reports (
  id bigserial primary key,
  citizen varchar(120) not null,
  zone varchar(120) not null,
  type varchar(120) not null,
  detail text not null,
  status varchar(60) not null default 'Pendiente',
  created_at timestamp not null default now()
);

create table if not exists collections (
  id bigserial primary key,
  zone_id bigint not null references zones(id),
  truck_id bigint not null references trucks(id),
  kg integer not null,
  status varchar(60) not null,
  date date not null,
  created_by bigint references users(id)
);

create table if not exists password_reset_tokens (
  id bigserial primary key,
  email varchar(160) not null,
  token varchar(120) not null unique,
  expires_at timestamp not null,
  created_at timestamp not null default now()
);

create table if not exists maintenance_records (
  id bigserial primary key,
  truck_id bigint not null references trucks(id),
  description text not null,
  status varchar(60) not null default 'Pendiente',
  created_at timestamp not null default now()
);

create table if not exists containers (
  id bigserial primary key,
  zone_id bigint not null references zones(id),
  name varchar(120) not null,
  fill_level integer not null check (fill_level between 0 and 100),
  status varchar(60) not null default 'Operativo',
  updated_at timestamp not null default now()
);

create table if not exists notifications (
  id bigserial primary key,
  user_id bigint references users(id),
  title varchar(120) not null,
  message text not null,
  type varchar(60) not null default 'info',
  is_read boolean not null default false,
  created_at timestamp not null default now()
);

-- ===========================================================================
-- Seguimiento en vivo del conductor (app móvil)
-- ===========================================================================
--
-- El conductor abre una sesión de ruta al pulsar "Iniciar ruta" y su móvil
-- emite la posición mientras dura. Se guardan las dos cosas: la sesión (para
-- saber quién salió, cuándo y por cuánto tiempo) y cada punto del recorrido
-- (para reconstruir el trayecto y auditarlo después).

create table if not exists route_sessions (
  id bigserial primary key,
  truck_id bigint not null references trucks(id),
  driver_id bigint not null references users(id),
  zone_id bigint references zones(id),
  status varchar(20) not null default 'activa',
  started_at timestamp not null default now(),
  finished_at timestamp,
  -- Métricas del recorrido, actualizadas al registrar cada posición.
  distance_m numeric(12, 2) not null default 0,
  positions_count integer not null default 0
);

-- Solo puede haber una sesión activa por camión: si no, dos móviles emitirían
-- posiciones contradictorias para el mismo vehículo.
create unique index if not exists route_sessions_one_active_per_truck
  on route_sessions (truck_id) where status = 'activa';

create index if not exists route_sessions_driver_idx on route_sessions (driver_id, started_at desc);

create table if not exists truck_positions (
  id bigserial primary key,
  session_id bigint not null references route_sessions(id) on delete cascade,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  -- Precisión y velocidad tal como las informa el GPS del móvil; sirven para
  -- descartar lecturas malas al reconstruir el trayecto.
  accuracy_m numeric(8, 2),
  speed_mps numeric(8, 2),
  recorded_at timestamp not null default now()
);

create index if not exists truck_positions_session_idx on truck_positions (session_id, recorded_at desc);

-- Token de notificaciones push por dispositivo. Un usuario puede tener varios
-- (móvil y tablet), y el mismo dispositivo puede cambiar de dueño, así que la
-- clave única es el token y el propietario se sobrescribe.
create table if not exists push_tokens (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  token varchar(200) not null unique,
  platform varchar(20),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists push_tokens_user_idx on push_tokens (user_id);

-- Última posición conocida del ciudadano. El aviso de proximidad se mide
-- contra ella, no contra el centro de su zona: "dos cuadras" solo significa
-- algo respecto de dónde está la persona.
create table if not exists user_locations (
  user_id bigint primary key references users(id) on delete cascade,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  accuracy_m numeric(8, 2),
  updated_at timestamp not null default now()
);

-- Aviso ya enviado, para no repetirlo en cada emisión de posición. Se limpia
-- cuando el camión se aleja o termina la sesión.
create table if not exists proximity_notices (
  id bigserial primary key,
  session_id bigint not null references route_sessions(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  distance_m numeric(10, 2) not null,
  sent_at timestamp not null default now(),
  unique (session_id, user_id)
);
