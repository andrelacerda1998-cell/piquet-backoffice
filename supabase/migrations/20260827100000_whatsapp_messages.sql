-- Conversas de WhatsApp.
--
-- O webhook ja recebia mensagens do WhatsApp, mas so guardava a PRIMEIRA de
-- cada contacto (como o campo `message` da lead). Tudo o que o cliente
-- escrevesse a seguir perdia-se -- e responder de volta era impossivel.
--
-- Esta tabela guarda a conversa inteira, nos dois sentidos: 'in' e o que o
-- cliente escreve, 'out' e o que a equipa responde pelo backoffice. Fica
-- ligada a lead pelo telefone (e pelo id quando existe), para o CRM abrir o
-- historico ao lado do pedido.
create table if not exists public.whatsapp_messages (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid references public.leads(id) on delete set null,
  phone         text not null,
  direction     text not null check (direction in ('in', 'out')),
  body          text not null default '',
  -- Id da mensagem na Meta: serve para nao processar a mesma duas vezes
  -- (a Meta reenvia o webhook ate receber 200) e para casar os updates de
  -- estado (entregue/lido) com a mensagem certa.
  wa_message_id text unique,
  -- received (entrada) | queued | sent | delivered | read | failed (saida).
  status        text not null default 'received',
  error         text not null default '',
  -- Email do staff que respondeu (vazio nas mensagens de entrada).
  sent_by       text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists whatsapp_messages_phone_idx on public.whatsapp_messages (phone, created_at);
create index if not exists whatsapp_messages_lead_idx on public.whatsapp_messages (lead_id, created_at);

alter table public.whatsapp_messages enable row level security;
