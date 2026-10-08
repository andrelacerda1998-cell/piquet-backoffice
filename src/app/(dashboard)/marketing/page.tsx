"use client";

import { useState, useMemo } from "react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { UnitEconomics } from "@/components/crescimento/UnitEconomics";
import { DataTable } from "@/components/ui/DataTable";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useAsyncData } from "@/hooks/useDashboard";
import { getCampaigns, getAdSpend, refreshAdSpend, type SpendMonth } from "@/services/marketingService";
import { toast } from "@/stores";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Megaphone, RefreshCw } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { CriarAnuncio } from "./CriarAnuncio";
import { Anuncios } from "./Anuncios";
import { PushCampanhas } from "./PushCampanhas";
import { Vouchers } from "./Vouchers";
import { costPerDownload } from "@/lib/adAttribution";
import { periodoCampanha, pareceParadaSemRegisto } from "@/lib/campaignPeriod";
import {
  campaignObjective, keyMetric, compararComPares, roasFazSentido,
  OBJECTIVE_LABEL, COMPARACAO_UI,
} from "@/lib/campaignObjective";
import type { MarketingCampaign } from "@/types";

/*
  ——— O que saiu deste ecrã, e porquê ———

  Eram duas abas, oito sub-abas e as MESMAS 11 campanhas desenhadas de quatro
  maneiras diferentes. `/marketing/campaigns`, `/marketing/channels` e
  `/marketing/creatives` leem todos a tabela `campaigns`: a lista, o gráfico
  "Canais" e a tabela "Desempenho por campanha" eram a mesma coisa três vezes.

  - "Funil de marketing": inventado. Não havia rota `/marketing/funnel`; o ecrã
    caía no mock e desenhava 500.000 impressões e taxas de conversão fixas que
    nunca vieram de lado nenhum.
  - "Canais": duas barras (Meta e Google) do mesmo agregado. O mesmo que a
    repartição por plataforma, num sítio onde ocupava um ecrã inteiro.
  - "CAC por canal": `lead_attribution` tem 30 linhas, nenhuma com campanha e
    nenhuma com cliente. Era uma análise vazia com ar de análise.
  - "Códigos de desconto": guardados em localStorage, semeados com quatro
    códigos que não existem e com 34.852 € de "receita gerada" — num negócio
    que gastou 1.105 € em anúncios desde sempre. No lugar deles está agora a
    lista de VOUCHERS reais, lida da tabela `vouchers` do Laravel (ver
    Vouchers.tsx) — a mesma que a app consulta quando o cliente aplica o
    código.

  Fica uma aba com as campanhas e as datas à frente, e outra com a comunicação.
*/

export default function MarketingPage() {
  const [criarAnuncioAberto, setCriarAnuncioAberto] = useState(false);
  const [campanhaParaAbrir, setCampanhaParaAbrir] = useState<string | null>(null);
  const [tab, setTab] = useState("campanhas");
  /**
   * Incrementa ao fim de uma recolha manual, para o ecrã mostrar já o que
   * acabou de ser gravado em vez de continuar a mostrar o anterior.
   */
  const [recarga, setRecarga] = useState(0);
  const { data: campaigns } = useAsyncData(() => getCampaigns(), [recarga]);
  const { data: spend } = useAsyncData(() => getAdSpend(), [recarga]);
  const [aAtualizar, setAAtualizar] = useState(false);
  const [estadoCampanhas, setEstadoCampanhas] = useState<"ativas" | "paradas" | "todas">("todas");

  /** Vai buscar já o desempenho ao Meta e ao Google (a rotina do cron das 06:20 UTC). */
  const atualizarAnuncios = async () => {
    setAAtualizar(true);
    try {
      const r = await refreshAdSpend();
      setRecarga((n) => n + 1);
      const partes = [`${r.upsertedCount} dia(s) de campanha recolhidos`];
      if (r.campaignsWritten) partes.push(`${r.campaignsWritten} campanhas atualizadas`);
      toast(partes.join(" · "), "success");
      // Plataforma sem gastos no período não é avaria, mas convém dizê-lo.
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
      cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      media: mesesSelecionados.length ? a.spend / mesesSelecionados.length : 0,
    };
  }, [mesesSelecionados]);

  /**
   * Os dados de anúncios vêm de um cron. Se ele falha, o ecrã continua a
   * mostrar os últimos números como se fossem de hoje — daí este aviso, que
   * também serve para duvidar das campanhas marcadas como "a correr".
   */
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

  const todas = campaigns ?? [];
  const campanhasAtivas = todas.filter((c) => c.status === "ativa");
  const campanhasParadas = todas.filter((c) => c.status !== "ativa");
  const campanhasVisiveis =
    estadoCampanhas === "ativas" ? campanhasAtivas
    : estadoCampanhas === "paradas" ? campanhasParadas
    : todas;

  const TABS: TabDef[] = [
    { id: "campanhas", label: "Campanhas", count: todas.length },
    { id: "comunicacao", label: "Comunicação" },
  ];

  return (
    <RouteGuard route="/marketing">
      <div className="space-y-6">
        <PageHeader
          icon={Megaphone}
          eyebrow="Crescimento"
          title="Marketing"
          subtitle="O que se gastou em anúncios, quando, e o que rendeu"
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

        {tab === "campanhas" && (
          <div className="space-y-6">
            <UnitEconomics />
            {/* Investimento real (ad_metrics: Meta + Google), com período à escolha. */}
            <div className="card p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-text-primary">Investimento em anúncios</h2>
                  <p className="text-xs text-text-secondary">
                    Meta e Google, dia a dia
                    {spend?.from && spend?.to && ` · de ${formatDate(spend.from)} a ${formatDate(spend.to)}`}
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
                  <p className="text-sm font-semibold text-danger">Dados parados há {diasSemDados} dias</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    O último dia com investimento registado é {spend?.to ? formatDate(spend.to) : "—"}. Enquanto a
                    recolha estiver a falhar, estes números não incluem o que se gastou desde então e as campanhas
                    marcadas como “a correr” podem já ter parado — ver Produto › Integrações.
                  </p>
                </div>
              )}

              {mesesSelecionados.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">Sem investimento registado neste período.</p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-text-secondary">Investido</p>
                    <p className="text-2xl font-bold text-text-primary tabular-nums">{formatCurrency(resumo.spend)}</p>
                    {mesesSelecionados.length > 1 && (
                      <p className="text-[11px] text-text-muted">{formatCurrency(resumo.media)}/mês em média</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Campanhas a correr</p>
                    <p className="text-2xl font-bold text-text-primary tabular-nums">{campanhasAtivas.length}</p>
                    <p className="text-[11px] text-text-muted">{campanhasParadas.length} já paradas</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Cliques</p>
                    <p className="text-2xl font-bold text-text-primary tabular-nums">{resumo.clicks.toLocaleString("pt-PT")}</p>
                    <p className="text-[11px] text-text-muted">
                      em {resumo.impressions.toLocaleString("pt-PT")} impressões · CTR {resumo.ctr.toFixed(2).replace(".", ",")}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Custo por clique</p>
                    <p className="text-2xl font-bold text-text-primary tabular-nums">
                      {resumo.clicks > 0 ? formatCurrency(resumo.cpc) : "—"}
                    </p>
                    <p className="text-[11px] text-text-muted">investido ÷ cliques</p>
                  </div>
                </div>
              )}
            </div>

            {/* ——— As campanhas, com as datas à frente ——— */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {([
                    { id: "todas", label: "Todas", n: todas.length },
                    { id: "ativas", label: "A correr", n: campanhasAtivas.length },
                    { id: "paradas", label: "Paradas", n: campanhasParadas.length },
                  ] as const).map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setEstadoCampanhas(o.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                        estadoCampanhas === o.id
                          ? "bg-piquet text-white"
                          : "bg-surface-subtle text-text-secondary hover:text-text-primary",
                      )}
                    >
                      {o.label} <span className="opacity-70">{o.n}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-muted">
                  {formatCurrency(campanhasVisiveis.reduce((s, c) => s + c.investment, 0))} investidos nestas
                </p>
              </div>

              <p className="rounded-xl bg-surface-subtle/60 px-3 py-2 text-xs text-text-secondary">
                Cada objetivo é julgado pela sua métrica — instalações pelo custo por instalação, leads pelo custo por
                lead, tráfego pelo custo por clique, notoriedade pelo custo por mil pessoas. O{" "}
                <strong className="text-text-primary">desempenho</strong> compara cada campanha com a mediana das outras
                do mesmo objetivo, não com metas de mercado que não teríamos como fundamentar.
              </p>

              {campanhasVisiveis.length === 0 ? (
                <p className="card p-6 text-center text-sm text-text-muted">
                  {estadoCampanhas === "ativas" ? "Nenhuma campanha a correr neste momento." : "Sem campanhas neste estado."}
                </p>
              ) : (
                <div className="space-y-3">
                  {[...campanhasVisiveis]
                    .sort((a, b) => b.investment - a.investment)
                    .map((c) => (
                      <CartaoCampanha
                        key={c.id}
                        campanha={c}
                        pares={campanhasVisiveis}
                        diasSemDados={diasSemDados}
                        onVerAnuncios={() => setCampanhaParaAbrir(c.campaignName)}
                      />
                    ))}
                </div>
              )}
            </div>

            {/* Anúncios reais das contas (Meta + Google), que se podem ligar e desligar. */}
            <Anuncios
              onCriar={() => setCriarAnuncioAberto(true)}
              abrirCampanha={campanhaParaAbrir}
              onAbertaCampanha={(encontrada) => {
                if (!encontrada) toast("Esta campanha não tem criativos ativos na conta de anúncios.", "info");
                setCampanhaParaAbrir(null);
              }}
            />

            {/*
              Repartição do investimento: interessa uma vez por mês, não de
              cada vez que se abre o ecrã. Fica fechada.
            */}
            <details className="card p-4">
              <summary className="cursor-pointer text-sm font-medium text-text-secondary hover:text-text-primary">
                Onde foi o dinheiro — por plataforma, por app e por mês
              </summary>
              <div className="mt-4 space-y-6">
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

                {/* Custo por download, só com o investimento que identifica a app. */}
                <div className="space-y-2">
                  <SectionHeader title="Custo por download" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([
                      { app: "App Cliente", cor: "#FAB347", cpd: resumo.cpdCliente, gasto: resumo.spendCliente, dl: resumo.dlCliente },
                      { app: "App Profissional", cor: "#3E7C8C", cpd: resumo.cpdProfissional, gasto: resumo.spendProfissional, dl: resumo.dlProfissional },
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
                      site, notoriedade) — ficam de fora destes custos, para não inflacionar nenhum. Contando tudo, o
                      custo por download é {resumo.cpdTotal != null ? formatCurrency(resumo.cpdTotal) : "—"}.
                    </p>
                  )}
                </div>

                {spendMeses.length > 0 && (
                  <div>
                    <SectionHeader title="Mês a mês" />
                    <DataTable
                      columns={[
                        { key: "month", label: "Mês", render: (m: SpendMonth) => <span className="font-medium capitalize">{nomeMes(m.month)}</span> },
                        { key: "spend", label: "Investido", render: (m: SpendMonth) => formatCurrency(m.spend) },
                        { key: "impressions", label: "Impressões", render: (m: SpendMonth) => m.impressions.toLocaleString("pt-PT") },
                        { key: "clicks", label: "Cliques", render: (m: SpendMonth) => m.clicks.toLocaleString("pt-PT") },
                        { key: "ctr", label: "CTR", render: (m: SpendMonth) => m.impressions > 0 ? `${((m.clicks / m.impressions) * 100).toFixed(2).replace(".", ",")}%` : "—" },
                        { key: "cpc", label: "Custo/clique", render: (m: SpendMonth) => m.clicks > 0 ? formatCurrency(m.spend / m.clicks) : "—" },
                      ]}
                      data={[...spendMeses].reverse()}
                      keyField="month"
                      emptyMessage="Sem investimento registado."
                    />
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        {tab === "comunicacao" && (
          <div className="space-y-6">
            <PushCampanhas />
            <div className="card p-4 space-y-3">
              <SectionHeader title="Vouchers" />
              <Vouchers />
            </div>
            {/*
              Saíram os "Guiões de mensagens": cinco textos escritos no código,
              dois deles com promessas que não existem (20% com o código
              PRIMAVERA, 10 € no próximo serviço). Quem os copiasse estaria a
              oferecer descontos que a app não reconhece.
            */}
          </div>
        )}

        <CriarAnuncio open={criarAnuncioAberto} onClose={() => setCriarAnuncioAberto(false)} />
      </div>
    </RouteGuard>
  );
}

/* ------------------------------ Uma campanha ------------------------------ */

/**
 * Uma campanha por cartão, em vez de uma linha de tabela.
 *
 * São onze campanhas ao todo — a densidade de uma tabela não compensa aqui, e
 * era ela que empurrava as datas para um subtítulo de 11px ao lado do nome.
 * O que se quer saber ao abrir isto é: quanto custou, quando correu, e se
 * ainda corre. Fica tudo em tamanho legível.
 */
function CartaoCampanha({
  campanha: c, pares, diasSemDados, onVerAnuncios,
}: {
  campanha: MarketingCampaign;
  pares: MarketingCampaign[];
  diasSemDados: number | null;
  onVerAnuncios: () => void;
}) {
  const p = periodoCampanha(c);
  const objetivo = campaignObjective(c.campaignName);
  const metrica = keyMetric(c, objetivo);
  const comparacao = COMPARACAO_UI[compararComPares(c, pares)];
  const duvidosa = pareceParadaSemRegisto(p, diasSemDados);
  const nomeConversoes = objetivo === "instalacao" ? "Instalações" : objetivo === "leads" ? "Leads" : "Conversões";

  /**
   * Nas campanhas de tráfego (e nas que não declaram objetivo) a métrica-chave
   * É o custo por clique — que já tem coluna própria. Sem isto, o cartão
   * mostrava "28,04 €" duas vezes seguidas, a mesma conta com dois nomes.
   */
  const chaveEhCpc = objetivo === "trafego" || objetivo === "indefinido";

  const numeros: Array<{ rotulo: string; valor: string; nota?: string; titulo?: string }> = [
    {
      rotulo: "Investido",
      valor: formatCurrency(c.investment),
      nota: p.gastoPorDia != null ? `${formatCurrency(p.gastoPorDia)}/dia` : undefined,
    },
    { rotulo: "Impressões", valor: c.impressions.toLocaleString("pt-PT") },
    {
      rotulo: "Cliques",
      valor: c.clicks.toLocaleString("pt-PT"),
      nota: c.impressions > 0 ? `CTR ${c.ctr.toFixed(2).replace(".", ",")}%` : undefined,
    },
    {
      rotulo: "Custo por clique",
      valor: c.clicks > 0 ? formatCurrency(c.investment / c.clicks) : "—",
      nota: chaveEhCpc ? "é a métrica deste objetivo" : undefined,
      titulo: chaveEhCpc ? metrica.hint : undefined,
    },
    {
      rotulo: nomeConversoes,
      valor: c.leads.toLocaleString("pt-PT"),
      titulo: `${c.leads} ${nomeConversoes.toLowerCase()} reportadas pela plataforma`,
    },
    ...(chaveEhCpc ? [] : [{
      rotulo: metrica.label,
      valor: metrica.value == null ? "—" : formatCurrency(metrica.value),
      titulo: metrica.hint,
    }]),
  ];

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-text-primary break-words" title={c.campaignName}>{c.campaignName}</p>
          <p className="text-sm text-text-secondary mt-0.5">
            {c.platform} · {OBJECTIVE_LABEL[objetivo]}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span title={comparacao.hint} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-help", comparacao.tone)}>
            {comparacao.label}
          </span>
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            p.aCorrer ? "bg-success-light text-success" : "bg-surface-subtle text-text-secondary",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", p.aCorrer ? "bg-success" : "bg-text-muted")} />
            {p.aCorrer ? "A correr" : "Parada"}
          </span>
        </div>
      </div>

      {/* As datas, que é o que este ecrã passou a responder primeiro. */}
      <div className="rounded-xl bg-surface-subtle/60 px-3 py-2">
        <p className="text-sm text-text-primary">
          {c.startDate ? (
            <>
              <span className="font-medium">{formatDate(c.startDate)}</span>
              {" → "}
              <span className="font-medium">{c.endDate ? formatDate(c.endDate) : "hoje"}</span>
              {p.dias != null && <span className="text-text-secondary"> · {p.dias} {p.dias === 1 ? "dia" : "dias"}</span>}
            </>
          ) : (
            <span className="text-text-muted">Sem datas registadas</span>
          )}
        </p>
        {p.paradaHaDias != null && (
          <p className="text-xs text-text-secondary mt-0.5">
            {p.paradaHaDias === 0 ? "Parada hoje" : `Parada há ${p.paradaHaDias} ${p.paradaHaDias === 1 ? "dia" : "dias"}`}
          </p>
        )}
        {duvidosa && (
          <p className="text-xs text-warning mt-1">
            Marcada como a correr, mas não há dados novos há {diasSemDados} dias — pode já ter parado na plataforma.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {numeros.map((n) => (
          <div key={n.rotulo} title={n.titulo}>
            <p className="text-xs text-text-secondary">{n.rotulo}</p>
            <p className="text-lg font-bold text-text-primary tabular-nums">{n.valor}</p>
            {n.nota && <p className="text-[11px] text-text-muted">{n.nota}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {/* O ROAS só aparece onde diz alguma coisa: numa campanha de
            notoriedade, "0,00×" leria-se como fracasso em vez de "não é isso
            que se lhe pede". */}
        {roasFazSentido(c) ? (
          <p className="text-xs text-text-secondary" title="Receita Piquet ÷ investimento (comissão de 25%)">
            ROAS <strong className="text-text-primary">{c.roas.toFixed(2)}×</strong> · {formatCurrency(c.piquetRevenue)} de receita atribuída
          </p>
        ) : (
          <span />
        )}
        <button onClick={onVerAnuncios} className="text-xs font-medium text-piquet-700 hover:underline">
          Ver anúncios desta campanha
        </button>
      </div>
    </div>
  );
}
