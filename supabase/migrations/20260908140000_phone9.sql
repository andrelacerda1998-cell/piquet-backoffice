/*
  O mesmo telefone escrito de duas maneiras.

  A landing grava "934670597"; a Meta manda "351934670597". O webhook procurava
  a lead pelo texto do telefone, não casava, e criava uma lead NOVA para a
  resposta da mesma pessoa -- foi assim que um "Ok" à confirmação virou um
  pedido de serviço separado do pedido real.

  Os últimos 9 dígitos são a identidade em Portugal. Coluna calculada (não
  escrita à mão) para não haver forma de divergir do telefone, e indexada
  porque é por aqui que o webhook procura a cada mensagem recebida.
*/
alter table leads
  add column if not exists phone9 text
  generated always as (right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 9)) stored;

create index if not exists leads_phone9 on leads (phone9) where phone9 <> '';

alter table whatsapp_messages
  add column if not exists phone9 text
  generated always as (right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 9)) stored;

create index if not exists whatsapp_messages_phone9 on whatsapp_messages (phone9);
