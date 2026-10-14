"use client";

import { useState, useMemo } from "react";
import { AnaliseDeClientes } from "@/components/crescimento/AnaliseDeClientes";
import { useTabParam } from "@/hooks/useTabParam";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { StatGroup, Stat } from "@/components/ui/Stats";
import { Painel } from "@/components/ui/Painel";

import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { ChartCard, LineChartComponent, BarChartComponent } from "@/components/charts/Charts";
import { useAsyncData } from "@/hooks/useDashboard";
import {
  getAppGrowth, getStoreRatings, getAppFunnel, getCustoPorDownload,
  type StoreRatingInfo, type CustoDownloadApp, type CustoDownload,
} from "@/services/backofficeService";
import { formatDate, formatNumber, formatCurrency, formatRating } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowDownRight } from "lucide-react";
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
    <div className="aviso aviso-atencao space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium text-text-primary">
            {fora}% do investimento não entra nestas contas
          </p>
          <p className="text-[13px] text-text-secondary mt-1">
            O custo por instalação de cada app só conta campanhas cujo nome diz para que app são.
            As restantes — tráfego para o site, angariação de pedidos, notoriedade — valem{" "}
            <b className="text-text-primary">{formatCurrency(custo.gastoNaoAtribuido)}</b> de{" "}
            {formatCurrency(custo.gastoTotal)} e não se sabe quantas instalações trouxeram.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-warning/20 pt-3 pl-[26px]">
        <div>
          <p className="text-xs text-text-secondary">Com tudo incluído</p>
          <p className="text-lg font-semibold text-text-primary tabular-nums mt-0.5">
            {custo.custoPorDownloadTudoIncluido != null
              ? formatCurrency(custo.custoPorDownloadTudoIncluido) : "—"}
          </p>
          {/* É o número para comparar com outro canal: o dinheiro do PMAX
              saiu da mesma conta, atribuído ou não. */}
          <p className="text-xs text-text-muted">todo o investimento ÷ todas as instalações</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Período</p>
          <p className="text-sm font-medium text-text-primary mt-1.5">{periodo}</p>
          <p className="text-xs text-text-muted">
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
  const lojas = [
    appStore && `App Store ${formatRating(appStore.rating)}`,
    googlePlay && `Google Play ${formatRating(googlePlay.rating)}`,
  ].filter(Boolean).join(" · ");
  return (
    <StatGroup cols={4} title={<><span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />{app}</>}>
      <Stat label="Instalações" value={formatNumber(total)} note="acumuladas" />
      <Stat label="Novas no mês" value={`+${formatNumber(novos)}`}
        note={<span className={cn(pct > 0 && "text-success")}>{pct > 0 ? "+" : ""}{formatNumber(Math.round(pct * 10) / 10)}% vs. mês anterior</span>} />
      <Stat label="Avaliação" value={media ? `${formatRating(media)} ★` : "—"}
        note={lojas || (avaliacoes > 0 ? `${formatNumber(avaliacoes)} avaliações` : "nas duas lojas")} />
      {/*
        O denominador ao lado do número. "0,36 €" sozinho não diz se saiu
        de duas instalações ou de quatrocentas, e a diferença entre as
        duas coisas é toda.
      */}
      <Stat label="Custo/instalação" value={custo?.custoPorDownload != null ? formatCurrency(custo.custoPorDownload) : "—"}
        note={custo && custo.downloads > 0
          ? `${formatCurrency(custo.gastoAtribuido)} ÷ ${formatNumber(custo.downloads)}`
          : "sem investimento atribuído"} />
    </StatGroup>
  );
}


export default function ProdutoView({ embutido = false }: { embutido?: boolean } = {}) {
  // Lê ?tab= para os alertas poderem apontar direto (ex.: Integrações).
  // Dentro de Crescimento, o separador de cá lê-se de ?vista= (o ?tab= é o de Crescimento).
  const [tab, setTab] = useTabParam("apps", embutido ? "vista" : "tab");
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
    { id: "clientes", label: "Clientes" },
  ];

  return (
    <RouteGuard route="/crescimento">
      <div className="space-y-6">
        {!embutido && (
          <PageHeader
            title="Produto"
            subtitle="Adoção das apps e jornada do utilizador"
          />
        )}

        <Tabs tabs={TABS} active={tab} onChange={setTab} variant={embutido ? "pill" : undefined} />

        {tab === "apps" && (
          <div className="space-y-6">
            {/* Um bloco por app: instalações, novas do mês, avaliação e custo juntos. */}
            <section className="space-y-3">
              <SectionHeader title="Adoção das apps" aside={latestMonthLabel || undefined} className="mb-0" />
              {/* Uma app por linha: a meia largura, as notas de cada número
                  (de onde sai a média, o denominador do custo) ficavam cortadas. */}
              <div className="space-y-3">
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
              <StatGroup cols={4} title="As duas apps">
                <Stat label="Instalações totais" value={formatNumber(dlTotalLast)} info="As duas apps somadas." />
                <Stat label="Novas no mês" value={formatNumber(newTotal)} info="Novas instalações das duas apps no último mês." />
                <Stat label="Novos clientes (mês)" value={formatNumber(regLast?.Clientes ?? 0)} demoEndpoint="/customers" />
                <Stat label="Novos técnicos (mês)" value={formatNumber(regLast?.Técnicos ?? 0)} demoEndpoint="/technicians" />
              </StatGroup>
              <CoberturaDoInvestimento custo={custo ?? null} />
            </section>

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

        {tab === "clientes" && <AnaliseDeClientes />}

        {tab === "funil" && (
          <div className="space-y-4">
            <SectionHeader
              title="Funil da jornada na app"
              description="Onde os utilizadores param, a partir do Mixpanel."
              aside={
                <select value={funnelPeriod} onChange={(e) => setFunnelPeriod(e.target.value)} className="input-field w-auto py-1.5" aria-label="Período do funil">
                  {funnelOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              }
            />

            {funnelLoading && !funnel ? (
              <div className="card p-6 text-sm text-text-muted">A carregar o funil…</div>
            ) : !funnel ? null : !funnel.configured ? (
              <div className="aviso aviso-info max-w-2xl">
                <p className="text-text-secondary">
                  Mostra onde os utilizadores param (abrir app → ver serviço → reservar → pagar), a partir do Mixpanel.
                  Ainda não está ligado. Para ativar, adiciona na Vercel:
                </p>
                <ul className="mt-3 space-y-1 text-text-secondary">
                  <li>• <code className="text-text-primary">MIXPANEL_SA_USERNAME</code> e <code className="text-text-primary">MIXPANEL_SA_SECRET</code> — Service Account (Organization Settings → Service Accounts)</li>
                  <li>• <code className="text-text-primary">MIXPANEL_PROJECT_ID</code> — id do projeto (Project Settings)</li>
                  <li>• <code className="text-text-primary">MIXPANEL_FUNNEL_ID</code> — id do funil guardado (opcional; senão usa o primeiro)</li>
                  <li>• <code className="text-text-primary">MIXPANEL_API_HOST</code> — <code>https://eu.mixpanel.com</code> se o projeto for na UE (opcional)</li>
                </ul>
                <p className="mt-3 text-xs text-text-muted">Passo-a-passo completo em <code>MIXPANEL_SETUP.md</code>. Cria o funil no Mixpanel com os passos da jornada; aqui aparece o drop-off de cada passo.</p>
              </div>
            ) : funnel.error ? (
              <div className="aviso aviso-perigo">
                <p className="font-medium">Não foi possível ler o funil do Mixpanel</p>
                <p className="text-text-secondary mt-1 break-words">{funnel.error}</p>
                <p className="text-xs text-text-muted mt-2">Verifica as credenciais e, se o projeto for na UE, define <code>MIXPANEL_API_HOST=https://eu.mixpanel.com</code>. Detalhes em <code>MIXPANEL_SETUP.md</code>.</p>
              </div>
            ) : funnel.steps.length === 0 ? (
              <div className="card p-6 text-sm text-text-muted">Sem dados do funil neste período. Experimenta outro no seletor.</div>
            ) : (
              (() => {
                // Uma só vista: barra por passo (largura = % do topo), com
                // utilizadores, % do topo e queda face ao passo anterior.
                const top = funnel.steps[0]?.count || 1;
                const stepLabel = (e: string) => e.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
                const totalConv = (funnel.steps[funnel.steps.length - 1]?.overallConvRatio ?? 0) * 100;
                return (
                  <Painel
                    titulo={funnel.name || "Funil da app"}
                    descricao={`${formatDate(funnel.from)} → ${formatDate(funnel.to)} · ${formatNumber(top)} utilizadores no topo`}
                    aside={
                      <span className="text-right">
                        <span className="block text-[22px] leading-7 font-semibold text-text-primary tabular-nums">{totalConv.toFixed(1).replace(".", ",")}%</span>
                        <span className="block text-xs text-text-muted">chegam ao fim</span>
                      </span>
                    }
                    corpo="px-4 py-3 space-y-1"
                  >
                    {funnel.steps.map((s, i) => (
                      <div key={i} className="py-2">
                        <div className="flex items-baseline justify-between gap-3 mb-1.5">
                          {/* O nome cru do evento fica à vista: sem ele não se
                              sabe QUE evento do Mixpanel alimenta cada passo,
                              e o rótulo bonito esconde exatamente isso. */}
                          <p className="text-[13px] font-medium text-text-primary truncate">
                            <span className="text-text-muted mr-1.5 tabular-nums">{i + 1}.</span>{stepLabel(s.event)}
                            <code className="ml-2 text-[11px] font-normal text-text-muted">{s.event}</code>
                          </p>
                          <div className="flex items-baseline gap-3 shrink-0 tabular-nums">
                            <span className="text-[13px] font-semibold">{formatNumber(s.count)}</span>
                            <span className="text-xs text-text-muted w-14 text-right">{(s.overallConvRatio * 100).toFixed(1).replace(".", ",")}%</span>
                            {i === 0 ? (
                              <span className="text-xs text-text-muted w-16 text-right">início</span>
                            ) : (
                              <span className={cn("inline-flex items-center justify-end gap-0.5 text-xs font-medium w-16", s.dropOff > 0.5 ? "text-danger" : s.dropOff > 0.25 ? "text-warning" : "text-success")}>
                                <ArrowDownRight className="h-3.5 w-3.5" /> −{(s.dropOff * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", i === funnel.steps.length - 1 ? "bg-success/80" : "bg-piquet")}
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
                  </Painel>
                );
              })()
            )}
          </div>
        )}

      </div>
    </RouteGuard>
  );
}
