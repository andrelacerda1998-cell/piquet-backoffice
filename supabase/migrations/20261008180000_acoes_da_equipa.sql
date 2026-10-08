-- =============================================================================
-- Ações da equipa (2026-10-08).
--
-- O backoffice fala com o Laravel por um token único, por isso os audits do
-- Laravel não sabem QUEM da equipa bloqueou um cliente ou suspendeu um
-- técnico. Esta tabela guarda-o, com o motivo, que passa a ser obrigatório
-- nessas ações. Só se acrescenta: nada a edita nem apaga.
-- =============================================================================
create table if not exists public.acoes_da_equipa (
  id           uuid primary key default gen_random_uuid(),
  criado_em    timestamptz not null default now(),
  staff_id     text not null,
  staff_email  text,
  acao         text not null,          -- 'bloquear_cliente', 'suspender_tecnico', …
  entidade     text not null,          -- 'cliente', 'tecnico'
  entidade_id  text not null,
  motivo       text,
  detalhe      jsonb
);

create index if not exists acoes_da_equipa_entidade on public.acoes_da_equipa (entidade, entidade_id, criado_em desc);
create index if not exists acoes_da_equipa_criado on public.acoes_da_equipa (criado_em desc);

-- Só o servidor (service role) lê e escreve: nada de acesso direto do browser.
alter table public.acoes_da_equipa enable row level security;
