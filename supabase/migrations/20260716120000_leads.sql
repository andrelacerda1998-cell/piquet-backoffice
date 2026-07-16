-- Leads da landing page (formulário público → POST /api/leads).
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  message text not null default '',
  source text not null default 'website',
  stage text not null default 'novo',
  created_at timestamptz not null default now()
);
-- RLS ligado sem policies: só o service role (Route Handlers) lê/escreve.
alter table public.leads enable row level security;
create index if not exists leads_created_at_idx on public.leads (created_at desc);
