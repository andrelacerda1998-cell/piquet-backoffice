-- Notas internas da equipa sobre um pedido, um cliente ou um técnico.
--
-- "Remarcado para amanhã de manhã", "cliente prefere WhatsApp", "técnico
-- avisou que chega 20 min atrasado": o que a equipa sabe e não está em lado
-- nenhum do Laravel. Cada nota guarda quem a escreveu e quando.
--
-- Só de acrescentar: uma nota não se edita nem se apaga (nem com a chave de
-- serviço). Um engano corrige-se com outra nota, como num processo em papel.

create table if not exists public.notas_internas (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  staff_id uuid,
  staff_email text,
  staff_nome text,
  entidade text not null check (entidade in ('pedido', 'cliente', 'tecnico')),
  entidade_id text not null,
  texto text not null check (char_length(btrim(texto)) between 1 and 2000)
);

create index if not exists notas_internas_entidade_idx
  on public.notas_internas (entidade, entidade_id, criado_em desc);

-- RLS ligado sem policies: só o service role (Route Handlers) lê e escreve.
alter table public.notas_internas enable row level security;

create or replace function public.notas_internas_so_acrescentar()
returns trigger language plpgsql as $$
begin
  raise exception 'As notas internas só se acrescentam: não se editam nem se apagam.';
end;
$$;

drop trigger if exists notas_internas_so_acrescentar on public.notas_internas;
create trigger notas_internas_so_acrescentar
  before update or delete on public.notas_internas
  for each row execute function public.notas_internas_so_acrescentar();
