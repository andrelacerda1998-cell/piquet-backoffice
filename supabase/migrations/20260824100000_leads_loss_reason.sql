-- Motivo de perda de um pedido do CRM.
--
-- 88% das leads acabam em recusado/perdido e não havia registo do porquê: não
-- se sabia se o negócio se perde no preço, na demora a responder, ou por não
-- haver técnico na zona. Cada causa exige uma decisão diferente.
--
-- `loss_reason` guarda um id curto da lista fechada (ver src/lib/leadLossReasons.ts)
-- para se poder contar; `loss_note` é o detalhe livre, sobretudo para "outro".
alter table public.leads add column if not exists loss_reason text;
alter table public.leads add column if not exists loss_note text not null default '';

comment on column public.leads.loss_reason is
  'Motivo da perda (id da lista fechada): preco, sem_tecnico, sem_resposta, demora, resolveu_sozinho, fora_ambito, duplicado, outro.';
