-- Registo manual de tesouraria.
--
-- O backoffice não tem ligação bancária, e o "Saldo atual" era uma constante
-- (185 000 €) de que dependiam também o "Saldo previsto" e o "Runway". Em vez
-- de inventar, passa a haver um sítio onde o saldo é REGISTADO: cada linha é
-- uma leitura da conta num dia, feita por alguém da equipa.
--
-- O mais recente é o que conta; os anteriores ficam como histórico.
create table if not exists public.treasury_balances (
  id text primary key,
  balance_date date not null,
  amount numeric(12,2) not null,
  account text not null default '',
  note text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists treasury_balances_date_idx
  on public.treasury_balances (balance_date desc);

comment on table public.treasury_balances is
  'Saldo de tesouraria registado à mão pelo staff. O mais recente alimenta o Saldo atual, o Saldo previsto e o Runway no Financeiro.';
