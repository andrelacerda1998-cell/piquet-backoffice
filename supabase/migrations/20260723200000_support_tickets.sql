-- Tickets de suporte reais (app cliente → POST /api/tickets → inbox do backoffice).
-- O id é o próprio ref humano ("TK-1101", …) para casar com a UI da SupportInbox.
create sequence if not exists support_ticket_seq start 1101;

create table if not exists public.support_tickets (
  id text primary key default ('TK-' || nextval('support_ticket_seq')::text),
  channel text not null default 'app_cliente',
  requester_type text not null default 'cliente',
  requester_name text not null default '',
  requester_email text not null default '',
  requester_phone text not null default '',
  subject text not null default '',
  category text not null default '',
  service_id text not null default '',
  priority text not null default 'media',
  status text not null default 'novo',
  -- [{ id, from: 'requester'|'agente', authorName, body, at }]
  messages jsonb not null default '[]'::jsonb,
  unread integer not null default 1,
  opened_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

-- RLS ligado sem policies: só o service role (Route Handlers) lê/escreve.
alter table public.support_tickets enable row level security;
create index if not exists support_tickets_last_message_idx
  on public.support_tickets (last_message_at desc);
create index if not exists support_tickets_status_idx
  on public.support_tickets (status);
