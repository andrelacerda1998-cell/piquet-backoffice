"use client";

import { useState, useMemo } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, SubTabs, type TabDef } from "@/components/ui/Tabs";
import { ChartCard, FunnelChartComponent, BarChartComponent, DonutChartComponent } from "@/components/charts/Charts";
import { useAsyncData } from "@/hooks/useDashboard";
import { getCampaigns, getMarketingFunnel, getCreativesPerformance, getChannelBreakdown, getAdSpend, refreshAdSpend, type SpendMonth } from "@/services/marketingService";
import { getScripts } from "@/services/extrasService";
import { SEED_PUSH, SEED_CODES, PUSH_SEGMENTS, type PushCampaign, type DiscountCode } from "@/services/backofficeService";
import { usePersistentList } from "@/hooks/usePersistentList";
import { Modal, Field } from "@/components/ui/Modal";
import { toast } from "@/stores";
import { formatCurrency, formatPercent, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { MessageSquare, BellRing, TicketPercent, Plus, Send, Megaphone, RefreshCw } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { costPerDownload } from "@/lib/adAttribution";
import type { MarketingCampaign } from "@/types";

/**
 * Classificação de uma campanha pelo retorno (ROAS = receita ÷ investimento).
 *
 * Regra honesta: sem conversões medidas (nem receita nem clientes atribuídos)
 * NÃO classificamos como "Má" — não há como julgar. Campanhas de notoriedade
 * ou sem tracking de conversões ficam "Sem dados" até haver o que medir.
 */
type CampaignRating = "excelente" | "bom" | "media" | "ma" | "sem_dados";

function rateCampaign(c: MarketingCampaign): CampaignRating {
  if (!c.piquetRevenue && !c.customers) return "sem_dados";
  if (c.roas >= 3) return "excelente";   // devolve 3× ou mais do investido
  if (c.roas >= 1.5) return "bom";       // lucrativa com margem confortável
  if (c.roas >= 1) return "media";       // paga-se a si própria
  return "ma";                            // gasta mais do que devolve
}

const RATING: Record<CampaignRating, { label: string; tone: string; hint: string }> = {
  excelente: { label: "Excelente", tone: "bg-success-light text-success", hint: "ROAS ≥ 3× — escalar" },
  bom: { label: "Bom", tone: "bg-piquet/15 text-piquet-700", hint: "ROAS 1,5×–3× — manter" },
  media: { label: "Média", tone: "bg-warning-light text-warning", hint: "ROAS 1×–1,5× — otimizar" },
  ma: { label: "Má", tone: "bg-danger-light text-danger", hint: "ROAS < 1× — dá prejuízo" },
  sem_dados: { label: "Sem dados", tone: "bg-surface-subtle text-text-secondary", hint: "Sem conversões medidas — não avaliável por ROAS" },
};

export default function MarketingPage() {
  const [tab, setTab] = useState("desempenho");
  const { data: campaigns } = useAsyncData(() => getCampaigns(), []);
  const { data: funnel } = useAsyncData(() => getMarketingFunnel(), []);
  const { data: creatives } = useAsyncData(() => getCreativesPerformance(), []);
  const { data: scripts } = useAsyncData(() => getScripts(), []);
  const { data: channels } = useAsyncData(() => getChannelBreakdown(), []);
  // Investimento REAL em anúncios (ad_metrics: Meta + Google), dia a dia.
  // `recarga` incrementa ao fim de uma recolha manual para o gráfico refletir
  // logo os dados novos, sem obrigar a recarregar a página.
  const [recarga, setRecarga] = useState(0);
  const { data: spend } = useAsyncData(() => getAdSpend(), [recarga]);
  const [aAtualizar, setAAtualizar] = useState(false);

  /**
   * Vai buscar já o desempenho ao Meta e ao Google (a mesma rotina do cron das
   * 06:20 UTC). O resultado é dito como é: quantas linhas entraram e, se uma
   * plataforma não trouxe nada, que isso quer dizer campanhas sem gastos — não
   * uma avaria.
   */
  const atualizarAnuncios = async () => {
    setAAtualizar(true);
    try {
      const r = await refreshAdSpend();
      setRecarga((n) => n + 1);
      const partes = [`${r.upsertedCount} dia(s) de campanha recolhidos`];
      if (r.campaignsWritten) partes.push(`${r.campaignsWritten} campanhas atualizadas`);
      toast(partes.join(" · "), "success");
      // Plataforma sem gastos no período não é erro, mas convém dizê-lo.
      for (const n of [...r.notes, ...r.skipped]) toast(n, "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao atualizar os anúncios.", "error");
    } finally {
      setAAtualizar(false);
    }
  };

  // Período em análise: "" = tudo · "2026" = ano · "2026-07" = mês.
  const [periodo, setPeriodo] = useState<string>("");
  const spendMeses = useMemo(() => spend?.months ?? [], [spend]);
  const anosDisponiveis = useMemo(
    () => [...new Set(spendMeses.map((m) => m.month.slice(0, 4)))].sort().reverse(),
    [spendMeses],
  );
  const mesesSelecionados = useMemo(
    () => (periodo ? spendMeses.filter((m) => m.month.startsWith(periodo)) : spendMeses),
    [spendMeses, periodo],
  );
  const resumo = useMemo(() => {
    const a = mesesSelecionados.reduce((acc, m) => ({
      spend: acc.spend + m.spend, impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks, conversions: acc.conversions + m.conversions,
      leads: acc.leads + m.leads,
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, leads: 0 });
    const plataformas: Record<string, number> = {};
    for (const m of mesesSelecionados) {
      for (const [k, v] of Object.entries(m.byPlatform)) plataformas[k] = (plataformas[k] ?? 0) + v;
    }
    // Investimento e downloads por app, para o custo por download.
    const apps = mesesSelecionados.reduce((acc, m) => ({
      spendCliente: acc.spendCliente + m.spendCliente,
      spendProfissional: acc.spendProfissional + m.spendProfissional,
      spendGeral: acc.spendGeral + m.spendGeral,
      dlCliente: acc.dlCliente + m.downloadsCliente,
      dlProfissional: acc.dlProfissional + m.downloadsProfissional,
    }), { spendCliente: 0, spendProfissional: 0, spendGeral: 0, dlCliente: 0, dlProfissional: 0 });
    return {
      ...a, plataformas, ...apps,
      cpdCliente: costPerDownload(apps.spendCliente, apps.dlCliente),
      cpdProfissional: costPerDownload(apps.spendProfissional, apps.dlProfissional),
      cpdTotal: costPerDownload(a.spend, apps.dlCliente + apps.dlProfissional),
      // CPL com os leads REAIS que chegaram, não com as "conversions" que cada
      // plataforma conta à sua maneira.
      cpl: a.leads > 0 ? a.spend / a.leads : 0,
      cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      media: mesesSelecionados.length ? a.spend / mesesSelecionados.length : 0,
    };
  }, [mesesSelecionados]);
  // Os dados de anúncios vêm de um cron. Se ele falha, o ecrã continua a
  // mostrar os últimos números como se fossem atuais — daí este aviso.
  const diasSemDados = useMemo(() => {
    if (!spend?.to) return null;
    const ms = Date.now() - new Date(spend.to + "T00:00:00Z").getTime();
    return Math.floor(ms / 86_400_000);
  }, [spend]);

  const MESES_PT = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const nomeMes = (ym: string) => {
    const [y, m] = ym.split("-");
    return `${MESES_PT[Number(m) - 1] ?? ym} ${y}`;
  };

  const campaignColumns: Column<MarketingCampaign>[] = [
    { key: "platform", label: "Plataforma" },
    { key: "campaignName", label: "Campanha" },
    { key: "investment", label: "Investimento", render: (r) => formatCurrency(r.investment) },
    { key: "impressions", label: "Impressões" },
    { key: "clicks", label: "Cliques" },
    { key: "ctr", label: "CTR", render: (r) => formatPercent(r.ctr) },
    { key: "leads", label: "Leads" },
    { key: "cpl", label: "CPL", render: (r) => formatCurrency(r.cpl) },
    { key: "customers", label: "Clientes" },
    { key: "cac", label: "CAC", render: (r) => formatCurrency(r.cac) },
    { key: "piquetRevenue", label: "Receita Piquet", render: (r) => formatCurrency(r.piquetRevenue) },
    { key: "roas", label: "ROAS", render: (r) => `${r.roas.toFixed(2)}x` },
    { key: "rating", label: "Classificação", render: (r) => {
      const c = RATING[rateCampaign(r)];
      return <span title={c.hint} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-help", c.tone)}>{c.label}</span>;
    } },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const creativeColumns: Column<Record<string, unknown>>[] = [
    { key: "name", label: "Criativo" },
    { key: "format", label: "Formato" },
    { key: "investment", label: "Investimento", render: (r) => formatCurrency(r.investment as number) },
    { key: "ctr", label: "CTR", render: (r) => formatPercent(r.ctr as number) },
    { key: "cpl", label: "CPL", render: (r) => formatCurrency(r.cpl as number) },
    { key: "cac", label: "CAC", render: (r) => formatCurrency(r.cac as number) },
    { key: "revenue", label: "Receita", render: (r) => formatCurrency(r.revenue as number) },
    { key: "roas", label: "ROAS", render: (r) => `${(r.roas as number).toFixed(2)}x` },
    { key: "recommendation", label: "Recomendação", render: (r) => <StatusBadge status={(r.recommendation as string) === "Escalar" ? "ativo" : (r.recommendation as string) === "Desativar" ? "cancelado_cliente" : "em_analise"} label={r.recommendation as string} /> },
  ];

  const TABS: TabDef[] = [
    { id: "desempenho", label: "Desempenho" },
    { id: "campanhas", label: "Campanhas", count: campaigns?.length },
    { id: "comunicacao", label: "Comunicação" },
  ];

  return (
    <RouteGuard route="/marketing">
      <div className="space-y-6">
        <PageHeader
          icon={Megaphone}
          eyebrow="Crescimento"
          title="Marketing"
          subtitle="Investimento em anúncios, aquisição e retorno"
          actions={
            <button
              onClick={atualizarAnuncios}
              disabled={aAtualizar}
              className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
              title="Vai buscar já o desempenho ao Meta e ao Google, sem esperar pelo cron diário"
            >
              <RefreshCw className={cn("h-4 w-4", aAtualizar && "animate-spin")} />
              {aAtualizar ? "A atualizar…" : "Atualizar anúncios"}
            </button>
          }
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "desempenho" && (
          <div className="space-y-6">
            {/* Investimento REAL, com período à escolha. Antes estes cartões
                mostravam uma série simulada (monthlyGrowth), o que dava uma
                tendência que nunca existiu. */}
            <div className="card p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-text-primary">Investimento em anúncios</h2>
                  <p className="text-xs text-text-secondary">
                    Meta e Google, dia a dia
                    {spend?.from && spend?.to && ` · dados de ${formatDate(spend.from)} a ${formatDate(spend.to)}`}
                  </p>
                </div>
                <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="input-field w-auto" aria-label="Período">
                  <option value="">Todo o período</option>
                  {anosDisponiveis.map((a) => <option key={a} value={a}>Ano de {a}</option>)}
                  {[...spendMeses].reverse().map((m) => (
                    <option key={m.month} value={m.month}>{nomeMes(m.month)}</option>
                  ))}
                </select>
              </div>

              {diasSemDados != null && diasSemDados > 3 && (
                <div className="rounded-xl border-l-[3px] border-l-danger bg-danger-light/40 px-3 py-2">
                  <p className="text-sm font-semibold text-danger">
                    Dados parados há {diasSemDados} dias
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    O último dia com investimento registado é {spend?.to ? formatDate(spend.to) : "—"}. A recolha de
                    anúncios está a falhar, por isso estes números não incluem o que se gastou desde então —
                    ver Produto › Integrações.
                  </p>
                </div>
              )}

              {mesesSelecionados.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">
                  Sem investimento registado neste período.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-text-secondary">Investido</p>
                      <p className="text-2xl font-bold text-text-primary tabular-nums">{formatCurrency(resumo.spend)}</p>
                      {mesesSelecionados.length > 1 && (
                        <p className="text-[11px] text-text-muted">{formatCurrency(resumo.media)}/mês em média</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">Leads recebidas</p>
                      <p className="text-2xl font-bold text-text-primary tabular-nums">{resumo.leads}</p>
                      <p className="text-[11px] text-text-muted">no mesmo período</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">Custo por lead</p>
                      <p className="text-2xl font-bold text-text-primary tabular-nums">
                        {resumo.leads > 0 ? formatCurrency(resumo.cpl) : "—"}
                      </p>
                      <p className="text-[11px] text-text-muted">investido ÷ leads reais</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">Cliques</p>
                      <p className="text-2xl font-bold text-text-primary tabular-nums">{resumo.clicks.toLocaleString("pt-PT")}</p>
                      <p className="text-[11px] text-text-muted">
                        {formatCurrency(resumo.cpc)}/clique · CTR {resumo.ctr.toFixed(2).replace(".", ",")}%
                      </p>
                    </div>
                  </div>

                  {/* Custo por download, por app — só com o investimento que
                      identifica a app; o resto fica de fora do cálculo. */}
                  <div className="space-y-2">
                    <SectionHeader title="Custo por download" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {([
                        { app: "App Cliente", cor: "#FAB347", cpd: resumo.cpdCliente, gasto: resumo.spendCliente, dl: resumo.dlCliente },
                        { app: "App Profissional", cor: "#1C1A17", cpd: resumo.cpdProfissional, gasto: resumo.spendProfissional, dl: resumo.dlProfissional },
                      ]).map((x) => (
                        <div key={x.app} className="rounded-xl border border-surface-border p-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: x.cor }} />
                            <p className="text-sm font-medium text-text-secondary">{x.app}</p>
                          </div>
                          <p className="mt-1 text-2xl font-bold text-text-primary tabular-nums">
                            {x.cpd != null ? formatCurrency(x.cpd) : "—"}
                          </p>
                          <p className="text-[11px] text-text-muted">
                            {x.gasto > 0
                              ? <>{formatCurrency(x.gasto)} em campanhas dela ÷ {x.dl.toLocaleString("pt-PT")} downloads</>
                              : <>sem campanhas identificadas para esta app · {x.dl.toLocaleString("pt-PT")} downloads no período</>}
                          </p>
                        </div>
                      ))}
                    </div>
                    {resumo.spendGeral > 0 && (
                      <p className="rounded-lg bg-surface-subtle px-3 py-2 text-[11px] text-text-muted">
                        {formatCurrency(resumo.spendGeral)} foram para campanhas que não identificam app (tráfego para o
                        site, notoriedade, landing pages) — ficam de fora destes custos, para não inflacionar nenhum.
                        Contando tudo, o custo por download é {resumo.cpdTotal != null ? formatCurrency(resumo.cpdTotal) : "—"}.
                      </p>
                    )}
                  </div>

                  {/* Onde foi o dinheiro */}
                  {Object.keys(resumo.plataformas).length > 0 && (
                    <div className="space-y-2">
                      <SectionHeader title="Por plataforma" />
                      {Object.entries(resumo.plataformas).sort((a, b) => b[1] - a[1]).map(([plat, valor]) => (
                        <div key={plat}>
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="font-medium text-text-primary capitalize">{plat}</span>
                            <span className="text-text-secondary tabular-nums">
                              {formatCurrency(valor)} · {resumo.spend > 0 ? Math.round((valor / resumo.spend) * 100) : 0}%
                            </span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                            <div className="h-full rounded-full bg-piquet"
                              style={{ width: `${resumo.spend > 0 ? (valor / resumo.spend) * 100 : 0}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Detalhe mensal */}
            {spendMeses.length > 0 && (
              <div>
                <SectionHeader title="Detalhe por mês" />
                <DataTable
                  columns={[
                    { key: "month", label: "Mês", render: (m: SpendMonth) => <span className="font-medium capitalize">{nomeMes(m.month)}</span> },
                    { key: "spend", label: "Investido", render: (m: SpendMonth) => formatCurrency(m.spend) },
                    { key: "impressions", label: "Impressões", render: (m: SpendMonth) => m.impressions.toLocaleString("pt-PT") },
                    { key: "clicks", label: "Cliques", render: (m: SpendMonth) => m.clicks.toLocaleString("pt-PT") },
                    { key: "ctr", label: "CTR", render: (m: SpendMonth) => m.impressions > 0 ? `${((m.clicks / m.impressions) * 100).toFixed(2).replace(".", ",")}%` : "—" },
                    { key: "leads", label: "Leads", render: (m: SpendMonth) => m.leads },
                    { key: "cpl", label: "Custo/lead", render: (m: SpendMonth) => m.leads > 0 ? formatCurrency(m.spend / m.leads) : "—" },
                  ]}
                  data={[...spendMeses].reverse()}
                  keyField="month"
                  emptyMessage="Sem investimento registado."
                />
              </div>
            )}
            <SubTabs
              tabs={[
                { id: "funil", label: "Funil" },
                { id: "canais", label: "Canais" },
                { id: "cac", label: "CAC por canal" },
                { id: "investimento", label: "Investimento" },
              ]}
            >
              {(sub) => (
                <>
                  {sub === "funil" && (
                    <ChartCard title="Funil de marketing">
                      <FunnelChartComponent data={(funnel ?? []).map((s) => ({ name: s.name, count: s.count, conversionRate: s.conversionRate }))} />
                    </ChartCard>
                  )}
                  {sub === "canais" && (
                    <ChartCard title="Performance por canal" subtitle="Investimento vs receita">
                      <BarChartComponent
                        data={(channels ?? []).map((c) => ({ name: c.name, investimento: c.investment, receita: c.revenue }))}
                        bars={[{ key: "investimento", color: "#D6503B", name: "Investimento" }, { key: "receita", color: "#FAB347", name: "Receita" }]}
                        currency
                      />
                    </ChartCard>
                  )}
                  {sub === "cac" && (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-secondary">
                        <b className="text-text-primary">CAC = investimento ÷ clientes adquiridos.</b> Custo de aquisição por cliente pagante, por canal.
                      </div>
                      <ChartCard title="CAC por canal" subtitle="Menor é melhor">
                        <BarChartComponent
                          data={(channels ?? []).map((c) => ({ name: c.name, value: (c as { cac?: number }).cac ?? 0 }))}
                          bars={[{ key: "value", color: "#3E7C8C", name: "CAC" }]}
                          currency
                        />
                      </ChartCard>
                      <DataTable
                        columns={[
                          { key: "name", label: "Canal", render: (r) => <span className="font-medium">{r.name as string}</span> },
                          { key: "investment", label: "Investimento", render: (r) => formatCurrency(r.investment as number) },
                          { key: "customers", label: "Clientes", render: (r) => `${(r.customers as number) ?? 0}` },
                          { key: "cac", label: "CAC", render: (r) => <span className="font-semibold">{formatCurrency((r.cac as number) ?? 0)}</span> },
                          { key: "roas", label: "ROAS", render: (r) => `${((r.roas as number) ?? 0).toFixed(2)}x` },
                        ]}
                        data={(channels ?? []) as unknown as Record<string, unknown>[]}
                        keyField="name"
                      />
                    </div>
                  )}
                  {sub === "investimento" && (
                    <ChartCard title="Distribuição do investimento por canal">
                      <DonutChartComponent data={(channels ?? []).map((c) => ({ name: c.name, value: c.investment }))} currency centerLabel="Investido" />
                    </ChartCard>
                  )}
                </>
              )}
            </SubTabs>
          </div>
        )}

        {tab === "campanhas" && (
          <SubTabs tabs={[{ id: "campanhas", label: "Campanhas" }, { id: "criativos", label: "Criativos" }]}>
            {(sub) => (
              <>
                {sub === "campanhas" && (
                  <div className="space-y-3">
                    {/* Legenda dos critérios de classificação (baseados no ROAS). */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                      <span className="font-medium">Classificação por retorno (ROAS):</span>
                      {(["excelente", "bom", "media", "ma", "sem_dados"] as CampaignRating[]).map((k) => (
                        <span key={k} className="inline-flex items-center gap-1.5">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full font-medium", RATING[k].tone)}>{RATING[k].label}</span>
                          <span className="text-text-muted">{RATING[k].hint}</span>
                        </span>
                      ))}
                    </div>
                    <DataTable columns={campaignColumns} data={campaigns ?? []} keyField="id" />
                  </div>
                )}
                {sub === "criativos" && (
                  <DataTable columns={creativeColumns} data={(creatives ?? []) as unknown as Record<string, unknown>[]} keyField="id" />
                )}
              </>
            )}
          </SubTabs>
        )}

        {tab === "comunicacao" && (
          <SubTabs tabs={[
            { id: "push", label: "Push" },
            { id: "codigos", label: "Códigos de desconto" },
            { id: "guioes", label: "Guiões e mensagens" },
          ]}>
            {(sub) => (
              <>
                {sub === "push" && <PushTab />}
                {sub === "codigos" && <CodigosTab />}
                {sub === "guioes" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(scripts ?? []).map((s) => (
                      <div key={s.id} className="card p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-text-primary">{s.title}</p>
                            <p className="text-xs text-text-secondary">{s.purpose}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-piquet/15 text-piquet-700">
                            <MessageSquare className="h-3 w-3" />{s.channel}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-text-secondary rounded-lg bg-surface-subtle px-3 py-2">{s.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </SubTabs>
        )}

      </div>
    </RouteGuard>
  );
}

/* ------------------------------ Push notifications ------------------------------ */

function PushTab() {
  const [campaigns, setCampaigns] = usePersistentList<PushCampaign>("push-campaigns", SEED_PUSH);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", segment: PUSH_SEGMENTS[0] as string, when: "agora" as "agora" | "agendar", scheduledFor: "2026-07-10T10:00" });

  const create = () => {
    if (!form.title.trim() || !form.message.trim()) { toast("Indica o título e a mensagem.", "error"); return; }
    const now = form.when === "agora";
    const c: PushCampaign = {
      id: `push_${Date.now()}`, title: form.title.trim(), message: form.message.trim(), segment: form.segment,
      status: now ? "enviada" : "agendada",
      sentAt: now ? new Date().toISOString() : undefined,
      scheduledFor: now ? undefined : form.scheduledFor,
      delivered: now ? Math.round(300 + Math.random() * 200) : 0,
      deliveryRate: now ? Math.round((92 + Math.random() * 6) * 10) / 10 : 0,
      openRate: now ? Math.round((25 + Math.random() * 20) * 10) / 10 : 0,
      conversions: now ? Math.round(5 + Math.random() * 30) : 0,
    };
    setCampaigns((prev) => [c, ...prev]);
    setOpen(false);
    setForm({ title: "", message: "", segment: PUSH_SEGMENTS[0], when: "agora", scheduledFor: "2026-07-10T10:00" });
    toast(now ? `Push "${c.title}" enviada ao segmento "${c.segment}".` : `Push "${c.title}" agendada.`);
  };

  const pushColumns: Column<PushCampaign>[] = [
    { key: "title", label: "Campanha", render: (r) => <div><p className="font-medium">{r.title}</p><p className="text-xs text-text-muted truncate max-w-[280px]">{r.message}</p></div> },
    { key: "segment", label: "Segmento" },
    { key: "status", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        r.status === "enviada" ? "bg-success-light text-success" : r.status === "agendada" ? "bg-info-light text-info" : "bg-surface-subtle text-text-secondary")}>
        {r.status === "enviada" ? "Enviada" : r.status === "agendada" ? "Agendada" : "Rascunho"}
      </span>
    ) },
    { key: "delivered", label: "Entregues", render: (r) => r.status === "enviada" ? `${r.delivered} (${r.deliveryRate}%)` : "—" },
    { key: "openRate", label: "Abertura", render: (r) => r.status === "enviada" ? formatPercent(r.openRate) : "—" },
    { key: "conversions", label: "Conversões", render: (r) => r.status === "enviada" ? `${r.conversions}` : "—" },
    { key: "when", label: "Quando", render: (r) => r.sentAt ? formatDate(r.sentAt) : r.scheduledFor ? `Agendada ${formatDate(r.scheduledFor)}` : "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary inline-flex items-center gap-2"><BellRing className="h-4 w-4 text-piquet-600" /> Campanhas push para clientes e técnicos, por segmento.</p>
        <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Nova campanha</button>
      </div>
      <DataTable columns={pushColumns} data={campaigns} keyField="id" emptyMessage="Sem campanhas push" />

      <Modal open={open} onClose={() => setOpen(false)} title="Nova campanha push" subtitle="Notificação para um segmento"
        footer={<>
          <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={create} className="btn-primary text-sm"><Send className="h-4 w-4" /> {form.when === "agora" ? "Enviar agora" : "Agendar"}</button>
        </>}>
        <div className="space-y-3">
          <Field label="Título"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Ex.: ☀️ Verão sem avarias" /></Field>
          <Field label="Mensagem"><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input-field resize-none" rows={3} placeholder="Texto da notificação (máx. ~140 caracteres)" /></Field>
          <Field label="Segmento"><select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="input-field">
            {PUSH_SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Envio"><select value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value as "agora" | "agendar" })} className="input-field">
              <option value="agora">Enviar imediatamente</option>
              <option value="agendar">Agendar</option>
            </select></Field>
            {form.when === "agendar" && (
              <Field label="Data e hora"><input type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} className="input-field" /></Field>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------ Códigos de desconto ------------------------------ */

function CodigosTab() {
  const [codes, setCodes] = usePersistentList<DiscountCode>("discount-codes", SEED_CODES);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", kind: "percentagem" as DiscountCode["kind"], value: 10, usageLimit: 200, validUntil: "2026-09-30", categories: "Todas", cities: "Todas" });

  const create = () => {
    if (!form.code.trim()) { toast("Indica o código.", "error"); return; }
    const c: DiscountCode = {
      id: `dc_${Date.now()}`, code: form.code.trim().toUpperCase(), kind: form.kind, value: Number(form.value) || 0,
      usageLimit: Number(form.usageLimit) || 0, used: 0, validUntil: form.validUntil,
      categories: form.categories.trim() || "Todas", cities: form.cities.trim() || "Todas", active: true, revenue: 0,
    };
    setCodes((prev) => [c, ...prev]);
    setOpen(false);
    setForm({ code: "", kind: "percentagem", value: 10, usageLimit: 200, validUntil: "2026-09-30", categories: "Todas", cities: "Todas" });
    toast(`Código ${c.code} criado e ativo.`);
  };

  const toggle = (id: string) => {
    setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c)));
    const c = codes.find((x) => x.id === id);
    toast(`Código ${c?.code} ${c?.active ? "desativado" : "ativado"}.`, c?.active ? "info" : "success");
  };

  const codeColumns: Column<DiscountCode>[] = [
    { key: "code", label: "Código", render: (r) => <span className="font-mono font-semibold">{r.code}</span> },
    { key: "value", label: "Desconto", render: (r) => r.kind === "percentagem" ? `${r.value}%` : formatCurrency(r.value) },
    { key: "used", label: "Utilizações", render: (r) => `${r.used}/${r.usageLimit}` },
    { key: "revenue", label: "Receita gerada", sortable: true, render: (r) => formatCurrency(r.revenue) },
    { key: "categories", label: "Categorias" },
    { key: "cities", label: "Cidades" },
    { key: "validUntil", label: "Válido até", render: (r) => formatDate(r.validUntil) },
    { key: "active", label: "Estado", render: (r) => (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", r.active ? "bg-success-light text-success" : "bg-surface-subtle text-text-secondary")}>
        {r.active ? "Ativo" : "Inativo"}
      </span>
    ) },
    { key: "acao", label: "", render: (r) => (
      <button onClick={() => toggle(r.id)} className={cn("text-xs hover:underline", r.active ? "text-danger" : "text-success")}>
        {r.active ? "Desativar" : "Ativar"}
      </button>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary inline-flex items-center gap-2"><TicketPercent className="h-4 w-4 text-piquet-600" /> Códigos promocionais — valor fixo ou percentagem, com limite e validade.</p>
        <button onClick={() => setOpen(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Novo código</button>
      </div>
      <DataTable columns={codeColumns} data={codes} keyField="id" emptyMessage="Sem códigos de desconto" />

      <Modal open={open} onClose={() => setOpen(false)} title="Novo código de desconto"
        footer={<>
          <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={create} className="btn-primary text-sm">Criar código</button>
        </>}>
        <div className="space-y-3">
          <Field label="Código"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-field font-mono" placeholder="VERAO25" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo"><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as DiscountCode["kind"] })} className="input-field">
              <option value="percentagem">Percentagem (%)</option>
              <option value="valor_fixo">Valor fixo (€)</option>
            </select></Field>
            <Field label={form.kind === "percentagem" ? "Desconto (%)" : "Desconto (€)"}><input type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="input-field" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Limite de utilizações"><input type="number" min={1} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })} className="input-field" /></Field>
            <Field label="Válido até"><input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="input-field" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categorias" hint="Ex.: AVAC, Limpeza — ou Todas"><input value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} className="input-field" /></Field>
            <Field label="Cidades" hint="Ex.: Lisboa, Cascais — ou Todas"><input value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} className="input-field" /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
