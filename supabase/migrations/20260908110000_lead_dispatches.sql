/*
  Difusão de um pedido à comunidade de técnicos.

  Uma linha por técnico contactado sobre uma lead. É isto que falta hoje entre
  "o cliente pediu" e "o técnico foi": a atribuição era o staff a escrever um
  nome num campo, sem ninguém ter sido perguntado.

  O técnico responde pelo WhatsApp e o webhook casa a resposta pelo telefone,
  por isso `phone` fica guardado aqui em vez de se ir buscar ao Laravel a cada
  mensagem recebida -- e fica como estava no momento do envio, mesmo que o
  técnico mude de número depois.

  `technician_id` é o id do Laravel (numérico) guardado como texto: os técnicos
  não vivem nesta base de dados e uma FK seria mentira.
*/
create table if not exists lead_dispatches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  technician_id text not null,
  technician_name text not null default '',
  phone text not null,
  -- enviado · aceite · recusado · falhou
  status text not null default 'enviado',
  error text not null default '',
  wa_message_id text,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

-- Um técnico só é perguntado uma vez por pedido. Sem isto, carregar duas vezes
-- em "Enviar" mandava a mesma pergunta duas vezes à mesma pessoa.
create unique index if not exists lead_dispatches_lead_tecnico
  on lead_dispatches (lead_id, technician_id);

-- O webhook procura por telefone entre as difusões ainda sem resposta.
create index if not exists lead_dispatches_phone_status
  on lead_dispatches (phone, status);

create index if not exists lead_dispatches_lead
  on lead_dispatches (lead_id, created_at desc);
