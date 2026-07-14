-- =============================================================================
-- 0007 — Métricas de anúncios (Meta Ads + Google Ads).
-- Alimentada pelo cron diário `/api/cron/ad-metrics` (service role).
-- Leitura: staff autenticado, via `/api/marketing/campaigns`.
-- Uma linha por (dia, plataforma, campanha). Conversões/receita vêm das
-- próprias plataformas (Pixel do Meta / tag do Google).
-- =============================================================================

create table if not exists public.ad_metrics (
  date              date not null,
  platform          text not null check (platform in ('meta', 'google')),
  campaign_id       text not null,
  campaign_name     text not null default '',
  spend             numeric not null default 0,
  impressions       integer not null default 0,
  clicks            integer not null default 0,
  conversions       numeric not null default 0,   -- leads/compras reportadas pela plataforma
  conversion_value  numeric not null default 0,   -- receita atribuída pela plataforma
  status            text not null default 'ativa',
  source            text not null default 'api',
  fetched_at        timestamptz not null default now(),
  primary key (date, platform, campaign_id)
);

comment on table public.ad_metrics is
  'Desempenho diário de campanhas Meta/Google Ads, ingerido das APIs (upsert idempotente).';

create index if not exists ad_metrics_date_idx on public.ad_metrics (date);

alter table public.ad_metrics enable row level security;

drop policy if exists "ad_metrics_read" on public.ad_metrics;
create policy "ad_metrics_read" on public.ad_metrics
  for select to authenticated using (true);
