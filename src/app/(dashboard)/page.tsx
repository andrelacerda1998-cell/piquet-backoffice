"use client";

import Link from "next/link";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { WelcomeBanner } from "@/components/ui/WelcomeBanner";
import { RequerAtencao } from "@/components/ui/RequerAtencao";
import { MetricCard, TrendIndicator } from "@/components/ui/MetricCard";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getFinanceGmv, getUnitEconomics, getFinanceSummary } from "@/services/financeService";
import { getGoals, getLeads } from "@/services/extrasService";
import { getServiceCounts } from "@/services/dashboardService";
import { getAppGrowth, getStoreRatings } from "@/services/backofficeService";
import { buildMetricValue } from "@/lib/calculations";
import type { MetricValue } from "@/types";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useTabParam } from "@/hooks/useTabParam";
import ObjetivosPage from "./objetivos/page";
import RelatoriosPage from "./relatorios/page";
import { MonthSelect } from "@/components/ui/MonthSelect";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { LayoutDashboard, ListChecks, Target, TrendingUp, ArrowRight, Scale, FileText } from "lucide-react";

function fmtGoal(v: number, unit: "currency" | "number" | "percentage") {
  if (unit === "currency") return formatCurrency(v);
  if (unit === "percentage") return `${formatNumber(v)}%`;
  return formatNumber(v);
}

/**
 * Cartão "herói" dos KPIs de topo — número grande, brilho subtil da marca,
 * variação real e sparkline. Reservado às duas métricas que mandam no negócio
 * (GMV e comissão do mês), para criar hierarquia acima dos restantes cartões.
 */
function HeroKpi({
  title, value, metric, deltaLabel, tone = "neutral",
}: {
  title: string;
  value: string;
  metric: MetricValue;
  deltaLabel: string;
  tone?: "brand" | "neutral";
}) {
  const sparkData = (metric.sparkline ?? []).map((v, i) => ({ i, v }));
  const showDelta = metric.value !== 0 || metric.changePercent !== 0;
  return (
    <div className={cn(
      "card relative overflow-hidden p-5",
      tone === "brand" && "bg-gradient-to-br from-piquet/[0.10] via-surface to-surface",
    )}>
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-piquet/10 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-text-secondary">{title}</p>
          {metric.tooltip && (
            <span title={metric.tooltip} className="text-text-muted cursor-help text-xs">ⓘ</span>
          )}
        </div>
        <p className="mt-2 text-3xl font-bold tracking-tight text-text-primary tabular-nums">{value}</p>
        {showDelta && (
          <span className="mt-2 inline-flex items-baseline gap-1">
            <TrendIndicator value={metric.changePercent} trend={metric.trend} />
            <span className="text-[11px] text-text-muted">{deltaLabel}</span>
          </span>
        )}
        {sparkData.length > 0 && (
          <div className="mt-3 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`hero-grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FAB347" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#FAB347" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#E39A1C" fill={`url(#hero-grad-${title})`} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Resultado do mês — o cartão que faltava.
 *
 * A Visão Geral mostrava o que ENTRA (GMV, comissão) e nunca o que SAI, por
 * isso não respondia à única pergunta que se faz ao abrir o ecrã de manhã.
 *
 * Quando não há fonte de custos mostra "—" em vez de um número: sem custos, o
 * resultado seria igual à receita e apareceria um lucro inventado.
 */
function ResultadoDoMes({ resultado, receita, custos }: {
  resultado: number | null;
  receita: number;
  custos: number;
}) {
  const positivo = (resultado ?? 0) >= 0;
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-text-secondary">Resultado do mês</p>
        <span
          title="Comissão da Piquet no mês menos os custos imputados ao mês (equipa + média das faturas de fornecedores)."
          className="text-text-muted cursor-help text-xs"
        >ⓘ</span>
      </div>
      {resultado === null ? (
        <>
          <p className="mt-2 text-3xl font-bold tracking-tight text-text-muted tabular-nums">—</p>
          <p className="mt-2 text-xs text-text-muted">
            Sem custos registados não dá para saber.{" "}
            <Link href="/financeiro?tab=custos" className="text-piquet-600 hover:underline">Registar custos</Link>
          </p>
        </>
      ) : (
        <>
          <p className={cn("mt-2 text-3xl font-bold tracking-tight tabular-nums",
            positivo ? "text-success" : "text-danger")}>
            {positivo ? "+" : "−"}{formatCurrency(Math.abs(resultado))}
          </p>
          {/* A composição em vez de uma variação: o mês vai a meio, e comparar
              com um mês anterior completo daria uma queda que não existe. */}
          <p className="mt-2 text-xs text-text-secondary tabular-nums">
            {formatCurrency(receita)} de comissão − {formatCurrency(custos)} de custos
          </p>
          <p className="mt-auto pt-2 text-[11px] text-text-muted">
            <Scale className="inline h-3 w-3 mr-0.5 align-[-1px]" />
            Mês a decorrer · <Link href="/financeiro" className="hover:underline">ver detalhe</Link>
          </p>
        </>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const { data: gmvData, loading, error, refetch } = useAsyncData(() => getFinanceGmv(), []);
  const { data: unit } = useAsyncData(() => getUnitEconomics(), []);
  // Resultado do mês: é a pergunta que traz um CEO a este ecrã ("ganhámos ou
  // perdemos dinheiro?") e a resposta estava só no Financeiro.
  const { data: fin } = useAsyncData(() => getFinanceSummary({ period: "este_mes" }), []);
  const { data: goalsData } = useAsyncData(() => getGoals(), []);
  const { data: svcCounts } = useAsyncData(() => getServiceCounts(), []);
  const { data: growth } = useAsyncData(() => getAppGrowth(), []);
  const { data: ratings } = useAsyncData(() => getStoreRatings(), []);
  const { data: leads } = useAsyncData(() => getLeads(), []);
  const [tab, setTab] = useTabParam("resumo");

  if (loading && !gmvData) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // GMV e comissão reais (Payshop cobrado + serviços concluídos).
  const gmvMonth = gmvData?.month.gmv ?? 0;
  const gmvPrevMonth = gmvData?.prevMonth.gmv ?? 0;
  const commissionMonth = gmvData?.month.commission ?? 0;
  const commissionPrevMonth = gmvData?.prevMonth.commission ?? 0;

  // Downloads da App Cliente (acumulados das lojas): total e crescimento do mês.
  const dl = growth?.downloads ?? [];
  const dlLast = dl[dl.length - 1];
  const dlPrev = dl[dl.length - 2];
  const clienteTotal = dlLast ? dlLast.Cliente : 0;
  const clientePrev = dlPrev ? dlPrev.Cliente : clienteTotal;

  // Avaliação média da app cliente nas lojas.
  const cliRatings = [ratings?.cliente.appStore, ratings?.cliente.googlePlay].filter(Boolean) as { rating: number }[];
  const storeRating = cliRatings.length
    ? Math.round((cliRatings.reduce((s, r) => s + r.rating, 0) / cliRatings.length) * 10) / 10
    : 0;

  // O que está à espera de alguém: leads por responder (e quantas urgentes) e
  // documentos KYC por validar. É o primeiro que se quer ver ao abrir o dia.
  /*
    O dia, em dois números que não existem em mais lado nenhum: quantos
    pedidos entraram hoje e quantos continuam sem técnico. O resto do que
    está à espera de alguém está no bloco "Requer atenção", acima.
  */
  const hoje = new Date().toISOString().slice(0, 10);
  const pedidosHoje = (leads ?? []).filter((l) => (l.createdAt || "").slice(0, 10) === hoje).length;
  const semTecnico = (leads ?? []).filter((l) => l.stage === "novo" || l.stage === "a_procurar").length;

  const goals = goalsData?.goals ?? [];
  const goalsOnTrack = goals.filter((g) => g.projection >= g.target).length;

  /**
   * Resultado do mês = comissão da Piquet no mês − custos imputados ao mês.
   *
   * Os custos vêm do Financeiro (equipa real + média das faturas de
   * fornecedores) e já vêm repartidos pelos dias decorridos, para não comparar
   * receita de 24 dias com um mês inteiro de custos.
   *
   * Sem fonte de custos NÃO se mostra um número: resultado = receita daria um
   * lucro que não existe, e é exatamente o tipo de zero que engana. Ver a
   * política "zero em vez de ficção" em services/api.ts.
   */
  const custosConhecidos = (fin?.teamCosts ?? 0) > 0 || (fin?.fixedCostsMonths ?? 0) > 0;
  const custosDoMes = (fin?.operatingCosts ?? 0) * (fin?.periodMonths ?? 0);
  const resultadoMes = fin?.periodResult ?? null;

  const gmvMonthMetric = buildMetricValue(gmvMonth, gmvPrevMonth, false, undefined, "Payshop cobrado + serviços concluídos, no mês.");
  const commissionMetric = buildMetricValue(commissionMonth, commissionPrevMonth, false, undefined, "Receita da Piquet no mês.");

  const TABS: TabDef[] = [
    { id: "resumo", label: "Resumo" },
    { id: "objetivos", label: "Objetivos do ano" },
    { id: "relatorios", label: "Relatórios" },
  ];

  return (
    <RouteGuard route="/">
      <div className="space-y-8">
        <WelcomeBanner />

        <PageHeader
          icon={LayoutDashboard}
          eyebrow="Visão geral"
          title="Visão executiva"
          subtitle="O essencial do negócio de relance — e para onde vamos."
          actions={
            <>
              <MonthSelect />
              <Link href="/chat?tab=tarefas" className="btn-secondary text-sm"><ListChecks className="h-4 w-4" /> Equipa</Link>
            </>
          }
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "resumo" && (
        <div className="space-y-8">
        {/*
          O que está à espera de alguém, vindo da mesma fonte das bolinhas do
          menu. Antes eram contas próprias sobre leads e documentos: dois dos
          sete tipos de problema, e com o risco de discordar do número que o
          menu mostrava ao lado.
        */}
        <RequerAtencao />

        {/* ---------- Indicadores-chave (reais) ---------- */}
        <div>
          <SectionHeader title="Indicadores-chave" />
          {/* Banda herói: as duas métricas que mandam no negócio, em destaque. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
            <HeroKpi title="GMV do mês" value={formatCurrency(gmvMonth)} metric={gmvMonthMetric} deltaLabel="vs mês ant." tone="brand" />
            <HeroKpi title="Comissão Piquet (mês)" value={formatCurrency(commissionMonth)} metric={commissionMetric} deltaLabel="vs mês ant." />
            <ResultadoDoMes
              resultado={custosConhecidos ? resultadoMes : null}
              receita={fin?.piquetRevenue ?? 0}
              custos={custosDoMes}
            />
          </div>
          {/*
            Volume de trabalho, ao lado do dinheiro. Executados contam-se pela
            data de conclusão e agendados pela data marcada -- um serviço
            agendado para dezembro é volume de dezembro, não deste mês. Por
            isso o "agendados no ano" olha para o ano inteiro, futuro incluído.
          */}
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-2">Serviços</p>
          {/*
            Só o mês. O acumulado do ano — GMV, comissão e serviços — passou
            para o Financeiro a 09/09/2026: é leitura de fim de mês, e aqui
            estava a competir com os números de hoje. Eram oito cartões para
            duas perguntas.
          */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            <MetricCard compact title="Pedidos hoje" hideDelta
              metric={buildMetricValue(pedidosHoje, pedidosHoje, false, undefined, "Pedidos que entraram desde a meia-noite, por qualquer via.")} />
            <MetricCard compact title="Sem técnico" hideDelta
              metric={buildMetricValue(semTecnico, semTecnico, false, undefined, "Pedidos abertos que ainda não têm técnico atribuído.")} />
            <MetricCard compact title="Executados no mês" hideDelta
              metric={buildMetricValue(svcCounts?.mes.executados ?? 0, svcCounts?.mes.executados ?? 0, false, undefined, "Serviços concluídos com data de conclusão dentro do mês corrente.")} />
            <MetricCard compact title="Agendados no mês" hideDelta
              metric={buildMetricValue(svcCounts?.mes.agendados ?? 0, svcCounts?.mes.agendados ?? 0, false, undefined, "Serviços com data marcada dentro do mês corrente e ainda por concluir.")} />
          </div>

          {/* Sinais da app — outra natureza, por isso separados do dinheiro. */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard title="Downloads App Cliente" format="number" hideDelta
              metric={buildMetricValue(clienteTotal, clientePrev, false, undefined, "Instalações acumuladas da app cliente (App Store + Google Play).")} />
            <MetricCard title="Avaliação nas lojas" hideDelta
              metric={buildMetricValue(storeRating, storeRating, false, undefined, "Média da app cliente (App Store + Google Play).")} />
          </div>
        </div>

        {/* ---------- Unit economics (LTV · CAC) ---------- */}
        <div>
          <SectionHeader
            title="Unit economics"
            aside={<>{unit?.newCustomersMonth ?? 0} clientes · {formatCurrency(unit?.adSpendMonth ?? 0)} em anúncios (mês)</>}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard title="CAC" format="currency" hideDelta
              metric={buildMetricValue(unit?.cac ?? 0, unit?.cac ?? 0, true, undefined, "Custo de aquisição por cliente = investimento em anúncios (mês) ÷ clientes novos (mês). Menor é melhor.")} />
            <MetricCard title="Serviços / cliente" hideDelta
              metric={buildMetricValue(unit?.servicesPerCustomer ?? 0, unit?.servicesPerCustomer ?? 0, false, undefined, "Serviços concluídos por cliente novo este mês.")} />
            <MetricCard title="LTV" format="currency" hideDelta
              metric={buildMetricValue(unit?.ltv ?? 0, unit?.ltv ?? 0, false, undefined, "Comissão média da Piquet por cliente (todo o histórico de serviços).")} />
            <MetricCard title="Rácio LTV/CAC" hideDelta
              metric={buildMetricValue(unit && unit.cac > 0 ? Math.round((unit.ltv / unit.cac) * 100) / 100 : 0, 0, false, undefined, "LTV ÷ CAC. Saudável acima de 3×.")} />
          </div>
        </div>

        {/* ---------- Objetivos do ano ---------- */}
        <div>
          <SectionHeader
            title="Objetivos do ano"
            icon={Target}
            aside={
              <div className="flex items-center gap-3">
                {goals.length > 0 && (
                  <span>· <b className="text-text-primary">{goalsOnTrack}/{goals.length}</b> no bom caminho</span>
                )}
                <Link href="/objetivos" className="text-piquet-600 font-medium hover:underline">Gerir objetivos →</Link>
              </div>
            }
          />

          {goals.length === 0 ? (
            <Link href="/objetivos" className="card p-6 flex items-center gap-4 hover:shadow-elevated transition-shadow">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-piquet/15 text-piquet-700 shrink-0"><Target className="h-5 w-5" /></span>
              <div>
                <p className="font-medium text-text-primary">Define os objetivos do ano</p>
                <p className="text-sm text-text-secondary">Associa metas a métricas reais (GMV, comissão, downloads…) e acompanha a evolução diária.</p>
              </div>
              <ArrowRight className="h-5 w-5 text-text-muted ml-auto shrink-0" />
            </Link>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {goals.slice(0, 6).map((g) => {
                const pct = g.target ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
                const willHit = g.projection >= g.target;
                return (
                  <Link key={g.id} href="/objetivos" className="card p-4 hover:shadow-elevated transition-shadow group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate group-hover:text-piquet-700 transition-colors">{g.label}</p>
                        <p className="text-xs text-text-muted">{g.metricLabel} · Meta {fmtGoal(g.target, g.unit)}</p>
                      </div>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
                        willHit ? "bg-success-light text-success" : "bg-warning-light text-warning")}>
                        {willHit ? <TrendingUp className="h-3 w-3" /> : <Target className="h-3 w-3" />}
                        {willHit ? "No bom caminho" : "Em risco"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <span className="text-xl font-bold text-text-primary tabular-nums">{fmtGoal(g.current, g.unit)}</span>
                      <span className="text-sm text-text-secondary">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-surface-subtle overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", willHit ? "bg-success" : "bg-piquet")} style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Atalhos para as outras vistas da Visão Geral, para ficarem à mão. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => setTab("objetivos")} className="card p-4 text-left hover:shadow-elevated transition-shadow flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-piquet/15 text-piquet-700 shrink-0"><Target className="h-5 w-5" /></span>
            <div className="min-w-0"><p className="font-semibold text-text-primary">Objetivos do ano</p><p className="text-xs text-text-muted">Metas e progresso</p></div>
            <ArrowRight className="h-4 w-4 text-text-muted ml-auto" />
          </button>
          <button onClick={() => setTab("relatorios")} className="card p-4 text-left hover:shadow-elevated transition-shadow flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-light text-info shrink-0"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0"><p className="font-semibold text-text-primary">Relatórios</p><p className="text-xs text-text-muted">Exportações e análises</p></div>
            <ArrowRight className="h-4 w-4 text-text-muted ml-auto" />
          </button>
        </div>
        </div>
        )}

        {tab === "objetivos" && <ObjetivosPage />}
        {tab === "relatorios" && <RelatoriosPage />}
      </div>
    </RouteGuard>
  );
}
