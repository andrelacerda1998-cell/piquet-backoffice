-- Observações internas de um pedido do CRM.
--
-- Campo separado de `message`: `message` é o que o CLIENTE escreveu (chega do
-- formulário da landing e não deve ser alterado), enquanto `notes` é o que a
-- equipa vai anotando ao longo do acompanhamento — o que ficou combinado ao
-- telefone, porque é que foi recusado, o que falta confirmar. Misturar os dois
-- faria perder o original.
alter table public.leads add column if not exists notes text not null default '';

comment on column public.leads.notes is
  'Observações internas da equipa sobre o pedido (não é a mensagem do cliente).';
