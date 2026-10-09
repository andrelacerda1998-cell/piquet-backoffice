"use client";

import { useState, useMemo } from "react";
import { useTabParam } from "@/hooks/useTabParam";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";

import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { ChartCard, LineChartComponent, BarChartComponent } from "@/components/charts/Charts";
import { useAsyncData } from "@/hooks/useDashboard";
import {
  getAppGrowth, getStoreRatings, getIntegrationsStatus, getAppFunnel, getCustoPorDownload,
  type StoreRatingInfo, type CustoDownloadApp, type CustoDownload,
} from "@/services/backofficeService";
import { buildMetricValue } from "@/lib/calculations";
import { formatDate, formatDateTime, formatNumber, formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Star, AlertTriangle, Plug, Filter, ArrowDownRight, LineChart } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";


/**
 * O que o custo por instalação NÃO conta.
 *
 * A despesa não tem campo "app": só o nome da campanha diz para quem é. A
 * maior de todas -- o PMAX de tráfego para o site -- não diz, e sozinha vale
 * a maior parte do investimento.
 *
 * Este painel existe para o número de cima não enganar. "0,36 € por
 * instalação" é verdade e parece excelente; com 86% do dinheiro de fora,
 * deixa de ser uma medida do que custa crescer. Quem olhar para o primeiro
 * número tem de ver este ao lado.
 */
function CoberturaDoInvestimento({ custo }: { custo: CustoDownload | null }) {
  if (!custo || custo.gastoTotal <= 0) return null;
  const fora = Math.round((1 - custo.cobertura) * 100);
  const periodo = custo.periodo
    ? `${formatDate(custo.periodo.de)} a ${formatDate(custo.periodo.ate)}`
    : "todo o histórico";

  return (
    <div className="card p-4 sm:p-5 space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            {fora}% do investimento não entra nestas contas
          </p>
          <p className="text-xs text-text-secondary mt-1">
            O custo por instalação de cada app só conta campanhas cujo nome diz para que app são.
            As restantes — tráfego para o site, angariação de pedidos, notoriedade — valem{" "}
            <b className="text-text-primary">{formatCurrency(custo.gastoNaoAtribuido)}</b> de{" "}
            {formatCurrency(custo.gastoTotal)} e não se sabe quantas instalações trouxeram.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-surface-border pt-3">
        <div>
          <p className="text-xs text-text-secondary">Com tudo incluído</p>
          <p className="text-xl font-bold text-text-primary tabular-nums mt-0.5">
            {custo.custoPorDownloadTudoIncluido != null
              ? formatCurrency(custo.custoPorDownloadTudoIncluido) : "—"}
          </p>
          {/* É o número para comparar com outro canal: o dinheiro do PMAX
              saiu da mesma conta, atribuído ou não. */}
          <p className="text-[11px] text-text-muted">todo o investimento ÷ todas as instalações</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Período</p>
          <p className="text-sm font-semibold text-text-primary mt-1.5">{periodo}</p>
          <p className="text-[11px] text-text-muted">
            a janela é a da despesa; as instalações contam-se só dentro dela
          </p>
        </div>
      </div>
    </div>
  );
}

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * Uma app, tudo o que interessa saber dela: instalações acumuladas, quantas
 * entraram no último mês (nº real + %) e como está avaliada nas lojas. Antes
 * isto estava espalhado por oito cartões que repetiam os mesmos números.
 */
function AppAdoptionCard({ app, accent, total, novos, pct, appStore, googlePlay, custo }: {
  app: string; accent: string; total: number; novos: number; pct: number;
  appStore: StoreRatingInfo | null; googlePlay: StoreRatingInfo | null;
  custo?: CustoDownloadApp | null;
}) {
  const notas = [appStore, googlePlay].filter(Boolean) as StoreRatingInfo[];
  const media = notas.length ? notas.reduce((s, r) => s + r.rating, 0) / notas.length : 0;
  const avaliacoes = notas.reduce((s, r) => s + (r.count ?? 0), 0);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-surface-border px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
        <p className="font-semibold text-text-primary">{app}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4">
        <div>
          <p className="text-xs text-text-secondary">Instalações</p>
          <p className="text-2xl font-bold text-text-primary tabular-nums mt-0.5">{formatNumber(total)}</p>
          <p className="text-[11px] text-text-muted">acumuladas</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Novas no mês</p>
          <p className="text-2xl font-bold text-text-primary tabular-nums mt-0.5">+{formatNumber(novos)}</p>
          <p className={cn("text-[11px] font-medium", pct > 0 ? "text-success" : "text-text-muted")}>
            {pct > 0 ? "+" : ""}{formatNumber(Math.round(pct * 10) / 10)}% vs. mês anterior
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Avaliação</p>
          <p className="text-2xl font-bold text-text-primary tabular-nums mt-0.5 inline-flex items-center gap-1">
            {media ? (Math.round(media * 10) / 10).toString().replace(".", ",") : "—"}
            {media > 0 && <Star className="h-4 w-4 fill-piquet-500 text-piquet-500" />}
          </p>
          <p className="text-[11px] text-text-muted">{avaliacoes > 0 ? `${formatNumber(avaliacoes)} avaliações` : "nas duas lojas"}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Custo/instalação</p>
          <p className="text-2xl font-bold text-text-primary tabular-nums mt-0.5">
            {custo?.custoPorDownload != null ? formatCurrency(custo.custoPorDownload) : "—"}
          </p>
          {/*
            O denominador ao lado do número. "0,36 €" sozinho não diz se saiu
            de duas instalações ou de quatrocentas, e a diferença entre as
            duas coisas é toda.
          */}
          <p className="text-[11px] text-text-muted">
            {custo && custo.downloads > 0
              ? `${formatCurrency(custo.gastoAtribuido)} ÷ ${formatNumber(custo.downloads)} no período`
              : "sem investimento atribuído"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 border-t border-surface-border px-5 py-2 text-[11px] text-text-muted">
        <span>App Store {appStore ? `${appStore.rating.toFixed(1)}★` : "—"}</span>
        <span>Google Play {googlePlay ? `${googlePlay.rating.toFixed(1)}★` : "—"}</span>
      </div>
    </div>
  );
}

/** Como se mostra o estado de cada pipeline (ver src/lib/saudeDasIntegracoes.ts). */
const ESTADO_DA_INTEGRACAO: Record<string, { tone: string; label: string }> = {
  ok: { tone: "bg-success-light text-success", label: "Operacional" },
  falha: { tone: "bg-danger-light text-danger", label: "Em falha" },
  atrasado: { tone: "bg-warning-light text-warning", label: "Atrasado" },
  sem_avisos: { tone: "bg-surface-subtle text-text-secondary", label: "Sem avisos" },
  nunca: { tone: "bg-surface-subtle text-text-secondary", label: "Nunca correu" },
};

export default function ProdutoPage() {
  // Lê ?tab= para os alertas poderem apontar direto (ex.: Integrações).
  const [tab, setTab] = useTabParam("apps");
  const { data: health } = useAsyncData(() => getIntegrationsStatus(), []);
  const { data: growth } = useAsyncData(() => getAppGrowth(), []);
  const { data: ratings } = useAsyncData(() => getStoreRatings(), []);

  /*
    Funil da app (Mixpanel): período à escolha — meses de calendário + atalhos.
    Por omissão o MÊS CORRENTE, e não "últimos 30 dias": o mês é a unidade em
    que o negócio é lido em todo o resto do backoffice (GMV, comissão,
    faturas), e uma janela deslizante nunca bate certo com esses números.
  */
  const mesCorrente = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [funnelPeriod, setFunnelPeriod] = useState(mesCorrente);
  const funnelOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}${i === 0 ? " (mês atual)" : ""}`,
      });
    }
    opts.push(
      { value: "30d", label: "Últimos 30 dias" },
      { value: "90d", label: "Últimos 90 dias" },
      { value: "ano", label: "Este ano" },
    );
    return opts;
  }, []);
  const funnelRange = useMemo(() => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const now = new Date();
    if (funnelPeriod === "30d") return { from: iso(new Date(Date.now() - 30 * 864e5)), to: iso(now) };
    if (funnelPeriod === "90d") return { from: iso(new Date(Date.now() - 90 * 864e5)), to: iso(now) };
    if (funnelPeriod === "ano") return { from: `${now.getUTCFullYear()}-01-01`, to: iso(now) };
    const [y, m] = funnelPeriod.split("-").map(Number);
    // No mês a decorrer o fim é HOJE: pedir até ao último dia do mês era pedir
    // dias que ainda não aconteceram.
    if (funnelPeriod === mesCorrente) return { from: `${funnelPeriod}-01`, to: iso(now) };
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${funnelPeriod}-01`, to: `${funnelPeriod}-${String(last).padStart(2, "0")}` };
  }, [funnelPeriod, mesCorrente]);
  const { data: funnel, loading: funnelLoading } = useAsyncData(() => getAppFunnel(funnelRange.from, funnelRange.to), [funnelPeriod]);

  const { data: custo } = useAsyncData(() => getCustoPorDownload(), []);
  const custoDe = (app: "cliente" | "profissional"): CustoDownloadApp | null =>
    custo?.apps.find((a) => a.app === app) ?? null;

  // Totais e variação mês-a-mês derivados das séries de crescimento.
  const dl = growth?.downloads ?? [];
  const reg = growth?.registrations ?? [];
  const last = <T,>(a: T[]) => a[a.length - 1];
  const prev = <T,>(a: T[]) => a[a.length - 2];
  const dlLast = last(dl), dlPrev = prev(dl);
  const regLast = last(reg);

  // Downloads totais (as duas apps somadas) e crescimento mês-a-mês.
  const dlTotalLast = (dlLast?.Cliente ?? 0) + (dlLast?.Profissional ?? 0);
  // Novos downloads por mês (diferença dos acumulados) — o crescimento mensal.
  const dlMonthly = dl.map((d, i) => ({
    name: d.name,
    Cliente: i === 0 ? 0 : Math.max(0, (d.Cliente ?? 0) - (dl[i - 1].Cliente ?? 0)),
    Profissional: i === 0 ? 0 : Math.max(0, (d.Profissional ?? 0) - (dl[i - 1].Profissional ?? 0)),
  })).slice(1);

  // Downloads NOVOS no último mês (nº real) + % de crescimento vs. total anterior.
  const dlNewLast = dlMonthly[dlMonthly.length - 1];
  const newCliente = dlNewLast?.Cliente ?? 0;
  const newProfissional = dlNewLast?.Profissional ?? 0;
  const newTotal = newCliente + newProfissional;
  const growthPct = (novos: number, totalAnterior: number) => (totalAnterior > 0 ? (novos / totalAnterior) * 100 : 0);
  const latestMonthLabel = dlLast?.name ?? "";

  const TABS: TabDef[] = [
    { id: "apps", label: "Apps" },
    { id: "funil", label: "Funil do produto" },
    { id: "integracoes", label: "Integrações" },
  ];

  return (
    <RouteGuard route="/produto">
      <div className="space-y-6">
        <PageHeader
          icon={LineChart}
          eyebrow="Produto"
          title="Produto"
          subtitle="Adoção das apps, jornada do utilizador e saúde das integrações"
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "apps" && (
          <div className="space-y-6">
            {/* Uma linha por app: instalações, novas do mês e avaliação juntas. */}
            <div>
              <SectionHeader title={`Adoção das apps${latestMonthLabel ? ` · ${latestMonthLabel}` : ""}`} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <AppAdoptionCard app="App Cliente" accent="#FAB347"
                  total={dlLast?.Cliente ?? 0} novos={newCliente} pct={growthPct(newCliente, dlPrev?.Cliente ?? 0)}
                  appStore={ratings?.cliente.appStore ?? null} googlePlay={ratings?.cliente.googlePlay ?? null}
                  custo={custoDe("cliente")} />
                {/* Era #1C1A17, quase preto: no tema escuro a série da App
                    Profissional desaparecia contra o fundo (1,0:1 de
                    contraste — literalmente invisível). O azul-petróleo da
                    paleta lê-se nos dois temas. */}
                <AppAdoptionCard app="App Profissional" accent="#3E7C8C"
                  total={dlLast?.Profissional ?? 0} novos={newProfissional} pct={growthPct(newProfissional, dlPrev?.Profissional ?? 0)}
                  appStore={ratings?.profissional.appStore ?? null} googlePlay={ratings?.profissional.googlePlay ?? null}
                  custo={custoDe("profissional")} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                <MetricCard title="Instalações totais" hideDelta
                  metric={buildMetricValue(dlTotalLast, dlTotalLast, false, undefined, "As duas apps somadas")} />
                <MetricCard title="Novas no mês (total)" hideDelta
                  metric={buildMetricValue(newTotal, newTotal, false, undefined, "Novas instalações das duas apps no último mês")} />
                <MetricCard title="Novos clientes (mês)" demoEndpoint="/customers" hideDelta
                  metric={buildMetricValue(regLast?.Clientes ?? 0, regLast?.Clientes ?? 0)} />
                <MetricCard title="Novos técnicos (mês)" demoEndpoint="/technicians" hideDelta
                  metric={buildMetricValue(regLast?.Técnicos ?? 0, regLast?.Técnicos ?? 0)} />
              </div>
              <div className="mt-3">
                <CoberturaDoInvestimento custo={custo ?? null} />
              </div>
            </div>

            <ChartCard title="Crescimento mensal de downloads" subtitle="Novas instalações em cada mês, por app">
              <BarChartComponent
                data={dlMonthly}
                bars={[
                  { key: "Cliente", color: "#FAB347", name: "App Cliente" },
                  { key: "Profissional", color: "#3E7C8C", name: "App Profissional" },
                ]}
              />
            </ChartCard>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Downloads acumulados por app" subtitle="Instalações totais ao longo dos últimos 12 meses">
                <LineChartComponent
                  data={dl}
                  lines={[
                    { key: "Cliente", color: "#FAB347", name: "App Cliente" },
                    { key: "Profissional", color: "#3E7C8C", name: "App Profissional" },
                  ]}
                />
              </ChartCard>
              <ChartCard title="Novos registos por mês" subtitle="Clientes e técnicos que se registaram">
                <LineChartComponent
                  data={reg}
                  lines={[
                    { key: "Clientes", color: "#FAB347", name: "Clientes" },
                    { key: "Técnicos", color: "#3B82F6", name: "Técnicos" },
                  ]}
                />
              </ChartCard>
            </div>

          </div>
        )}

        {tab === "integracoes" && (
          <div className="space-y-6">
            {/* Falhas repetidas primeiro — é o alerta que faltava quando o
                Google Play esteve uma semana em 403 sem ninguém reparar. */}
            {(health?.jobs ?? []).filter((j) => j.consecutiveFailures >= 2).map((j) => (
              <div key={`alert-${j.id}`} className="card p-4 border-l-4 border-danger bg-danger-light/40 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-text-primary">{j.name} está a falhar há {j.consecutiveFailures} execuções seguidas</p>
                  <p className="text-xs text-text-secondary mt-0.5">Último erro: {j.lastDetail || "—"} · Último sucesso: {j.lastOkAt ? formatDateTime(j.lastOkAt) : "nunca"}</p>
                </div>
              </div>
            ))}

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">Pipelines de dados</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(health?.jobs ?? []).map((j) => {
                  const estado = j.estado ?? (j.lastRunOk === null ? "nunca" : j.lastRunOk ? "ok" : "falha");
                  const { tone, label } = ESTADO_DA_INTEGRACAO[estado];
                  return (
                    <div key={j.id} className="card p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-piquet/15 text-piquet-700 shrink-0"><Plug className="h-4 w-4" /></span>
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary truncate">{j.name}</p>
                            <p className="text-[11px] text-text-muted">{j.providers.join(" + ")} · {j.schedule}</p>
                          </div>
                        </div>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0", tone)}>{label}</span>
                      </div>
                      <p className="text-xs text-text-secondary">
                        {j.lastRunAt
                          ? <>Última execução {formatDateTime(j.lastRunAt)} · {j.lastUpserted} registos{!j.lastRunOk && j.lastDetail ? <> · <span className="text-danger">{j.lastDetail.slice(0, 120)}</span></> : null}</>
                          : estado === "sem_avisos" ? "Nenhum aviso do Payshop recebido." : "Sem execuções registadas — a primeira fica registada no próximo ciclo."}
                      </p>
                      {estado === "sem_avisos" && (
                        <p className="text-xs text-text-muted">
                          O Payshop só avisa as ordens criadas com o URL do aviso, que o Laravel junta quando tem
                          PAYSHOP_SDK_NOTIFICATION_URL definida. Até lá o cron diário das 06:30 traz tudo na mesma.
                        </p>
                      )}
                      {estado === "atrasado" && (
                        <p className="text-xs text-warning">Não corre há mais de um dia: o cron devia ter corrido entretanto.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">Credenciais configuradas</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(health?.configured ?? {}).map(([name, on]) => (
                  <span key={name} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                    on ? "bg-success-light text-success" : "bg-surface-subtle text-text-muted")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-success" : "bg-text-muted")} />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "funil" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-piquet-600" />
                <div>
                  <h2 className="text-lg font-bold text-text-primary">Funil da jornada na app</h2>
                  <p className="text-xs text-text-muted">Onde os utilizadores param, a partir do Mixpanel.</p>
                </div>
              </div>
              <select value={funnelPeriod} onChange={(e) => setFunnelPeriod(e.target.value)} className="input-field w-auto">
                {funnelOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {funnelLoading && !funnel ? (
              <div className="card p-6 text-sm text-text-secondary">A carregar o funil…</div>
            ) : !funnel ? null : !funnel.configured ? (
              <div className="card p-6 max-w-2xl">
                <p className="text-sm text-text-secondary">
                  Mostra onde os utilizadores param (abrir app → ver serviço → reservar → pagar), a partir do Mixpanel.
                  Ainda não está ligado. Para ativar, adiciona na Vercel:
                </p>
                <ul className="mt-3 space-y-1 text-sm text-text-secondary">
                  <li>• <code className="text-text-primary">MIXPANEL_SA_USERNAME</code> e <code className="text-text-primary">MIXPANEL_SA_SECRET</code> — Service Account (Organization Settings → Service Accounts)</li>
                  <li>• <code className="text-text-primary">MIXPANEL_PROJECT_ID</code> — id do projeto (Project Settings)</li>
                  <li>• <code className="text-text-primary">MIXPANEL_FUNNEL_ID</code> — id do funil guardado (opcional; senão usa o primeiro)</li>
                  <li>• <code className="text-text-primary">MIXPANEL_API_HOST</code> — <code>https://eu.mixpanel.com</code> se o projeto for na UE (opcional)</li>
                </ul>
                <p className="mt-3 text-xs text-text-muted">Passo-a-passo completo em <code>MIXPANEL_SETUP.md</code>. Cria o funil no Mixpanel com os passos da jornada; aqui aparece o drop-off de cada passo.</p>
              </div>
            ) : funnel.error ? (
              <div className="card p-6 border-l-4 border-danger bg-danger-light/40">
                <p className="font-semibold text-text-primary">Não foi possível ler o funil do Mixpanel</p>
                <p className="text-sm text-text-secondary mt-1 break-words">{funnel.error}</p>
                <p className="text-xs text-text-muted mt-2">Verifica as credenciais e, se o projeto for na UE, define <code>MIXPANEL_API_HOST=https://eu.mixpanel.com</code>. Detalhes em <code>MIXPANEL_SETUP.md</code>.</p>
              </div>
            ) : funnel.steps.length === 0 ? (
              <div className="card p-6 text-sm text-text-secondary">Sem dados do funil neste período. Experimenta outro no seletor.</div>
            ) : (
              (() => {
                // Uma só vista: barra por passo (largura = % do topo), com
                // utilizadores, % do topo e queda face ao passo anterior.
                const top = funnel.steps[0]?.count || 1;
                const stepLabel = (e: string) => e.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
                const totalConv = (funnel.steps[funnel.steps.length - 1]?.overallConvRatio ?? 0) * 100;
                return (
                  <div className="card p-5 space-y-1">
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-surface-border mb-2">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{funnel.name || "Funil da app"}</p>
                        <p className="text-xs text-text-muted">{formatDate(funnel.from)} → {formatDate(funnel.to)} · {formatNumber(top)} utilizadores no topo</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-3xl font-bold text-text-primary">{totalConv.toFixed(1)}%</p>
                        <p className="text-xs text-text-muted">chegam ao fim</p>
                      </div>
                    </div>
                    {funnel.steps.map((s, i) => (
                      <div key={i} className="py-2">
                        <div className="flex items-baseline justify-between gap-3 mb-1">
                          {/* O nome cru do evento fica à vista: sem ele não se
                              sabe QUE evento do Mixpanel alimenta cada passo,
                              e o rótulo bonito esconde exatamente isso. */}
                          <p className="text-sm font-medium text-text-primary truncate">
                            <span className="text-text-muted mr-1.5">{i + 1}.</span>{stepLabel(s.event)}
                            <code className="ml-2 text-[11px] font-normal text-text-muted">{s.event}</code>
                          </p>
                          <div className="flex items-baseline gap-3 shrink-0 tabular-nums">
                            <span className="text-sm font-semibold">{formatNumber(s.count)}</span>
                            <span className="text-xs text-text-muted w-14 text-right">{(s.overallConvRatio * 100).toFixed(1)}%</span>
                            {i === 0 ? (
                              <span className="text-xs text-text-muted w-16 text-right">início</span>
                            ) : (
                              <span className={cn("inline-flex items-center justify-end gap-0.5 text-xs font-semibold w-16", s.dropOff > 0.5 ? "text-danger" : s.dropOff > 0.25 ? "text-warning" : "text-success")}>
                                <ArrowDownRight className="h-3.5 w-3.5" /> −{(s.dropOff * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-3 rounded-full bg-surface-subtle overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", i === funnel.steps.length - 1 ? "bg-success" : "bg-piquet")}
                            style={{ width: `${Math.max(1.5, (s.count / top) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-text-muted pt-2">
                      Os passos são os eventos do Mixpanel listados a cinzento
                      (<code className="text-text-secondary">{funnel.steps.map((s) => s.event).join(", ")}</code>),
                      definidos no funil <b className="text-text-secondary">{funnel.name || funnel.funnelId}</b> — para
                      mudar quais se detetam, edita esse funil no Mixpanel.
                      A percentagem é sobre o topo; a seta é a queda face ao passo anterior, vermelha quando cai mais de metade.
                    </p>
                  </div>
                );
              })()
            )}
          </div>
        )}

      </div>
    </RouteGuard>
  );
}
