-- =============================================================================
-- 0008 — Pagamentos da app (Payshop Online Payments / Paylands).
-- Alimentada pelo cron `/api/cron/pop-transactions` (service role) a partir de
-- GET https://api.paylands.com/v1/orders. Leitura: staff, via /api/finance/app-payments.
-- =============================================================================

create table if not exists public.pop_transactions (
  transaction_uuid  text primary key,
  order_uuid        text not null default '',
  customer_ext_id   text not null default '',
  amount_cents      integer not null default 0,
  currency          text not null default 'EUR',
  status            text not null default '',     -- SUCCESS | REFUSED | ...
  type              text not null default '',     -- PURCHASE | REFUND | CANCELLATION | ...
  service           text not null default '',     -- SIBS | CREDORAX | PAYSHOP
  created           timestamptz,
  updated_at        timestamptz,
  fetched_at        timestamptz not null default now()
);

comment on table public.pop_transactions is
  'Transações do Payshop Online Payments (plataforma Paylands), upsert idempotente por transaction_uuid.';

create index if not exists pop_transactions_created_idx on public.pop_transactions (created);
create index if not exists pop_transactions_status_idx on public.pop_transactions (status);

alter table public.pop_transactions enable row level security;

drop policy if exists "pop_transactions_read" on public.pop_transactions;
create policy "pop_transactions_read" on public.pop_transactions
  for select to authenticated using (true);

-- Marca do cartão (distingue cartão de MB Way) + índice por encomenda.
alter table public.pop_transactions
  add column if not exists source_type text not null default '';
create index if not exists pop_transactions_order_idx on public.pop_transactions (order_uuid);
