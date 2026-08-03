-- SEC-01 — fechar a leitura pública de tickets de suporte.
--
-- Problema: o id é sequencial ("TK-1101", "TK-1102", …) e o GET /api/tickets é
-- público (a app cliente não tem sessão do backoffice). Bastava enumerar ids
-- para ler o assunto e a resposta do agente de tickets de outros clientes —
-- confirmado com um pedido real durante a auditoria de 2026-08-03.
--
-- Correção: cada ticket passa a ter um token aleatório (uuid v4, 122 bits de
-- entropia) que só o dispositivo que o criou conhece. O GET deixa de aceitar
-- ids e passa a exigir tokens. O id continua a ser o ref humano na UI do
-- backoffice — só deixa de servir como credencial de leitura.
alter table public.support_tickets
  add column if not exists access_token uuid not null default gen_random_uuid();

-- O GET filtra por access_token; sem índice seria um seq scan por pedido.
create unique index if not exists support_tickets_access_token_idx
  on public.support_tickets (access_token);
