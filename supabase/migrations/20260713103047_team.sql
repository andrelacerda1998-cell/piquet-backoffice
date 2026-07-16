-- =============================================================================
-- Piquet — Equipa: conversas internas (team_messages) e agenda/reuniões (team_meetings).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Mensagens de equipa (canais e diretas). thread_id = id do canal ou `dm:<uuid>`.
-- ---------------------------------------------------------------------------
create table if not exists public.team_messages (
  id          text primary key,
  thread_id   text not null,
  author_id   uuid references public.staff(id) on delete set null,
  author_name text not null,
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists team_messages_thread_idx on public.team_messages (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- Agenda / reuniões da equipa interna.
-- ---------------------------------------------------------------------------
create table if not exists public.team_meetings (
  id           text primary key,
  person       text not null,           -- colaborador dono do evento
  date         date not null,
  start_time   text not null,           -- HH:mm
  end_time     text not null,
  title        text not null,
  type         text not null default 'reuniao'
               check (type in ('reuniao','foco','externo','ausencia')),
  participants text[] not null default '{}',
  location     text,
  created_by   uuid references public.staff(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists team_meetings_person_date_idx on public.team_meetings (person, date);

-- =============================================================================
-- RLS — leitura a autenticados; escritas via service role (Route Handlers).
-- =============================================================================
alter table public.team_messages enable row level security;
alter table public.team_meetings enable row level security;

drop policy if exists team_messages_read on public.team_messages;
drop policy if exists team_meetings_read on public.team_meetings;
create policy team_messages_read on public.team_messages for select using (auth.role() = 'authenticated');
create policy team_meetings_read on public.team_meetings for select using (auth.role() = 'authenticated');
