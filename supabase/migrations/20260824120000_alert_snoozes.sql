-- Adiamentos de alertas.
--
-- Os alertas são recalculados a cada visita e não têm estado: desaparecem
-- quando o motivo deixa de existir. Isso está certo para o que se resolve
-- depressa, e errado para o que fica pendente por decisão -- uma obrigação
-- fiscal vencida continua vencida até ser paga, e ver a mesma linha vermelha
-- todos os dias ensina a ignorar o vermelho.
--
-- Adiar não resolve nem esconde: guarda uma data a partir da qual o alerta
-- volta a aparecer. O id é o mesmo que as regras geram (ou o do grupo).
create table if not exists public.alert_snoozes (
  alert_id      text primary key,
  snooze_until  timestamptz not null,
  note          text not null default '',
  created_by    text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists alert_snoozes_until_idx on public.alert_snoozes (snooze_until);

alter table public.alert_snoozes enable row level security;
