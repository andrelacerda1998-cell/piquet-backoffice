-- Objetivos do ano associados a uma métrica de negócio.
create table if not exists public.goals (
  id text primary key,
  metric text not null,
  label text not null default '',
  target numeric not null default 0,
  unit text not null default 'number',
  year int not null default extract(year from now()),
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.goals enable row level security;

-- Snapshot diário do valor de cada métrica (a evolução que os objetivos seguem).
create table if not exists public.metric_snapshots (
  metric text not null,
  date date not null,
  value numeric not null default 0,
  captured_at timestamptz not null default now(),
  primary key (metric, date)
);
alter table public.metric_snapshots enable row level security;
create index if not exists metric_snapshots_metric_date_idx on public.metric_snapshots (metric, date);
