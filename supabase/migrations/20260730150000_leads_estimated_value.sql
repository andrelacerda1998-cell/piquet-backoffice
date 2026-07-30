-- Valor estimado/a cobrar por lead, para o CEO se organizar financeiramente
-- (pedido explícito, 2026-07-30). Inserido/editado manualmente no backoffice
-- -- o formulário público não tem este campo, ninguém o preenche sozinho.
alter table public.leads add column if not exists estimated_value numeric not null default 0;
