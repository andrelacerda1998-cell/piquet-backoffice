-- =============================================================================
-- Pagamentos a técnicos REAIS (2026-07-22): a lista deixa de vir do seed
-- technician_payouts e passa a derivar dos SERVIÇOS concluídos (technician_value
-- agrupado por técnico × mês). Esta tabela guarda apenas o que já foi
-- PROCESSADO — o resto calcula-se sempre a partir dos serviços.
-- =============================================================================
create table if not exists public.technician_payout_records (
  id              text primary key,          -- "po|<YYYY-MM>|<techKey>"
  technician_key  text not null,             -- technician_id, ou "nome:<slug>" sem FK
  technician_name text not null,
  period          text not null,             -- 'YYYY-MM'
  amount          numeric(12,2) not null,
  services        integer not null default 0,
  paid_at         timestamptz not null default now(),
  unique (technician_key, period)
);

alter table public.technician_payout_records enable row level security;
drop policy if exists technician_payout_records_read on public.technician_payout_records;
create policy technician_payout_records_read on public.technician_payout_records
  for select using (auth.role() = 'authenticated');
