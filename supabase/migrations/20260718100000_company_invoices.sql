-- Faturas de custos da empresa (a pagar). Entrada manual OU automática do
-- Outlook. O estado (pendente/parcial/pago) deriva do valor já pago.
create table if not exists public.company_invoices (
  id text primary key,
  vendor text not null default '',
  description text not null default '',
  amount numeric not null default 0,
  amount_paid numeric not null default 0,
  issue_date date,
  due_date date,
  source text not null default 'manual',
  email_subject text,
  email_from text,
  attachment_name text,
  attachment_url text,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.company_invoices enable row level security;
create index if not exists company_invoices_due_idx on public.company_invoices (due_date);
