-- Registo de execuções dos crons/webhooks de integração (saúde das integrações).
create table if not exists public.cron_runs (
  id bigint generated always as identity primary key,
  job text not null,
  ok boolean not null,
  detail text not null default '',
  upserted integer not null default 0,
  ran_at timestamptz not null default now()
);
alter table public.cron_runs enable row level security;
create index if not exists cron_runs_job_ran_idx on public.cron_runs (job, ran_at desc);
