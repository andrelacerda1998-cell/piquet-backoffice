-- =============================================================================
-- Piquet — Pagamentos a técnicos (technician_payouts).
-- Os valores derivam dos serviços (technician_value); o ESTADO (pendente/
-- processado) é persistido aqui, para o "Processar" sobreviver.
-- =============================================================================

create table if not exists public.technician_payouts (
  id              text primary key,
  technician_name text not null,
  services        int not null default 0,
  amount_due      numeric not null default 0,
  period          text not null,
  status          text not null default 'pendente'
                  check (status in ('pendente', 'processado')),
  processed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists technician_payouts_status_idx on public.technician_payouts (status);

alter table public.technician_payouts enable row level security;
drop policy if exists technician_payouts_read on public.technician_payouts;
create policy technician_payouts_read on public.technician_payouts for select using (auth.role() = 'authenticated');
