-- =============================================================================
-- Lotes de pagamento a técnicos (2026-10-08).
--
-- Pagar um técnico era um clique que zerava a carteira, sem segunda pessoa e
-- sem prova de que a transferência saiu. Um lote é criado por uma pessoa,
-- aprovado por OUTRA, marcado como pago depois das transferências (só aí o
-- Laravel debita cada carteira, pelo valor do lote) e conferido contra o
-- extrato do banco. Ver src/lib/lotesPagamento.ts.
-- =============================================================================
create table if not exists public.payout_lotes (
  id                  uuid primary key default gen_random_uuid(),
  estado              text not null default 'rascunho'
                        check (estado in ('rascunho', 'aprovado', 'pago', 'cancelado')),
  total               numeric(12,2) not null default 0,
  notas               text,
  criado_por          text not null,
  criado_por_email    text,
  criado_em           timestamptz not null default now(),
  aprovado_por        text,
  aprovado_por_email  text,
  aprovado_em         timestamptz,
  pago_por            text,
  pago_por_email      text,
  pago_em             timestamptz,
  cancelado_por_email text,
  cancelado_em        timestamptz,
  -- A segunda pessoa é a razão de existir disto: a base de dados também o garante.
  constraint payout_lotes_aprovador_diferente check (aprovado_por is null or aprovado_por <> criado_por)
);

create table if not exists public.payout_lote_linhas (
  id              uuid primary key default gen_random_uuid(),
  lote_id         uuid not null references public.payout_lotes(id) on delete cascade,
  vendor_id       bigint not null,
  vendor_name     text,
  iban            text,
  valor           numeric(12,2) not null check (valor > 0),
  estado          text not null default 'por_pagar'
                    -- 'a_pagar': reservada por um pedido que está a chamar o Laravel.
                    -- Impede que dois cliques paguem a mesma linha duas vezes; se o
                    -- servidor cair a meio fica assim, para alguém confirmar à mão.
                    check (estado in ('por_pagar', 'a_pagar', 'pago', 'falhou', 'confirmado')),
  erro            text,
  pago_em         timestamptz,
  saldo_restante  numeric(12,2),
  confirmado_em   timestamptz,
  movimento       jsonb,
  unique (lote_id, vendor_id)
);

create index if not exists payout_lote_linhas_vendor on public.payout_lote_linhas (vendor_id);
create index if not exists payout_lotes_estado on public.payout_lotes (estado, criado_em desc);

-- Só o servidor (service role) lê e escreve: nada de acesso direto do browser.
alter table public.payout_lotes enable row level security;
alter table public.payout_lote_linhas enable row level security;
