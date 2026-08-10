-- =============================================================================
-- Piquet — Canais de conversa da equipa (antes uma lista fixa no código,
-- com canais fictícios que nunca existiram de facto — ver TEAM_CHANNELS em
-- extrasService.ts antes desta migration). Agora persistidos, para dar à
-- equipa a possibilidade de criar novos canais quando precisar.
-- =============================================================================
create table if not exists public.team_channels (
  id         text primary key,
  name       text not null unique,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.team_channels enable row level security;

drop policy if exists team_channels_read on public.team_channels;
create policy team_channels_read on public.team_channels for select using (auth.role() = 'authenticated');

-- Único canal real até hoje (2026-08-10) — os restantes ("operações",
-- "suporte", "marketing", "direção") eram só nomes de exemplo no código,
-- sem conteúdo real, removidos a pedido do utilizador.
insert into public.team_channels (id, name)
values ('geral', 'geral')
on conflict (id) do nothing;
