/*
  Quem é técnico, do lado de cá.

  Os técnicos vivem no Laravel, não nesta base de dados. Mas o webhook do
  WhatsApp precisa de decidir, a cada mensagem recebida e em milissegundos, se
  quem escreve é um cliente ou alguém da rede -- e ir ao Laravel a cada
  mensagem seria pôr um serviço externo no caminho de todas as mensagens que
  entram, incluindo quando ele está em baixo.

  Guarda-se só o mínimo para essa decisão: os últimos 9 dígitos do telefone, o
  id e o nome. Nada de morada, NIF ou IBAN -- esses continuam a viver num sítio
  só, que é o Laravel.
*/
create table if not exists technician_phones (
  phone9 text primary key,
  technician_id text not null,
  name text not null default '',
  updated_at timestamptz not null default now()
);

/*
  De quem é esta mensagem.

  `lead_id` continua a ser o cliente. `technician_id` é o outro lado: uma
  mensagem de um técnico deixa de ter de arranjar uma lead para pertencer a
  alguma coisa -- era isso que o obrigava a entrar no CRM como se fosse um
  pedido de serviço.
*/
alter table whatsapp_messages
  add column if not exists technician_id text;

create index if not exists whatsapp_messages_technician
  on whatsapp_messages (technician_id, created_at desc)
  where technician_id is not null;
