-- CRM de pedidos de serviço: o estado da lead passa a seguir o pipeline
-- "Não iniciado → Orçamento enviado → Orçamento aceite → Recusado → Concluído".
-- (Os estados guardam-se como texto; a app valida os valores. Estados antigos
-- de marketing, se existirem, são mapeados na leitura em /api/marketing/leads.)
alter table public.leads alter column stage set default 'nao_iniciado';
