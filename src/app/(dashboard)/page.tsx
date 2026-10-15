"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { WelcomeBanner } from "@/components/ui/WelcomeBanner";
import { TrendIndicator } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatGroup, Stat } from "@/components/ui/Stats";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getFinanceGmv, getFinanceSummary } from "@/services/financeService";
import { getOperacoesAoVivo } from "@/services/dashboardService";
import { pct, pctDeFracao } from "@/lib/aoVivo";
import { PrecisaDeTi } from "@/components/hoje/PrecisaDeTi";
import { buildMetricValue } from "@/lib/calculations";
import { useAuthStore } from "@/stores";
import { hasAnyPermission } from "@/lib/permissions";
import type { Permission } from "@/types";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useTabParam } from "@/hooks/useTabParam";
import AlertasPage from "./alertas/Alertas";
import { formatCurrency } from "@/lib/formatters";
import { ArrowRight } from "lucide-react";


/*
  A Visão Geral é "Hoje" (auditoria de 08/10/2026, secção 8): responde em
  cinco segundos a duas perguntas -- "há alguma coisa a arder?" e "o negócio
  está a andar?".

  1. A fila "Precisa de ti": o que está à espera de alguém, com um botão cada.
  2. Agora: quatro números ao vivo.
  3. Este mês: a taxa de pedidos servidos (o número que mede o marketplace),
     o GMV, a comissão e o resultado -- numa linha.

  Saíram daqui os números do ano, os objetivos em cartões, os atalhos, o
  seletor de mês (não mudava nada nesta página) e o botão "Equipa". O CAC, o
  LTV, os downloads e os objetivos estão em Crescimento.
*/

function OverviewPageInner() {
  const { data: gmvData, loading, error, refetch } = useAsyncData(() => getFinanceGmv(), []);
  // Resultado do mês: é a pergunta que traz um CEO a este ecrã ("ganhámos ou
  // perdemos dinheiro?") e a resposta estava só no Financeiro.
  const { data: fin } = useAsyncData(() => getFinanceSummary({ period: "este_mes" }), []);
  const role = useAuthStore((s) => s.user?.role);
  const pode = (...p: Permission[]) => !!role && hasAnyPermission(role, p);
  // O marketplace agora: os mesmos números de Pedidos › Ao vivo.
  const { data: aoVivo } = useAsyncData(
    () => (pode("view_services") ? getOperacoesAoVivo() : Promise.resolve(null)).catch(() => null),
    [role],
  );
  const [tab, setTab] = useTabParam("resumo");
  const [totalAlertas, setTotalAlertas] = useState<number | null>(null);

  if (loading && !gmvData) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // GMV e comissão: o cobrado no Payshop (ver api/_lib/gmv.ts). A seta compara
  // com os mesmos dias do mês passado: o mês corrente ainda vai a meio.
  const comparar = gmvData?.prevMonthToDate ?? gmvData?.prevMonth;
  const gmvMes = buildMetricValue(gmvData?.month.gmv ?? 0, comparar?.gmv ?? 0, false);
  const comissaoMes = buildMetricValue(gmvData?.month.commission ?? 0, comparar?.commission ?? 0, false);

  /*
    Resultado do mês = comissão da Piquet no mês − custos imputados ao mês.
    Sem fonte de custos NÃO se mostra um número: resultado = receita daria um
    lucro que não existe ("zero em vez de ficção", services/api.ts).
  */
  const custosConhecidos = (fin?.teamCosts ?? 0) > 0 || (fin?.fixedCostsMonths ?? 0) > 0;
  const resultado = custosConhecidos ? fin?.periodResult ?? null : null;
  const custosDoMes = (fin?.operatingCosts ?? 0) * (fin?.periodMonths ?? 0);

  /*
    Pedidos servidos: servidos ÷ criados no mês de calendário (o backend novo
    manda-o). Com o backend de antes, os últimos 30 dias, ditos como tal.
  */
  const mes = aoVivo?.liquidez.mes;
  const trinta = aoVivo?.liquidez["30d"];
  const servidos = mes
    ? { valor: pctDeFracao(mes.taxa), nota: `${mes.servidos} de ${mes.criados} pedidos do mês`, zero: mes.criados > 0 && mes.servidos === 0 }
    : trinta
      ? { valor: pct(trinta.taxa_servidos), nota: `${trinta.servidos} de ${trinta.terminados} terminados (30 dias)`, zero: trinta.terminados > 0 && trinta.servidos === 0 }
      : null;

  // Técnicos online por cidade: onde não há ninguém é onde se perdem pedidos.
  const porCidade = (aoVivo?.oferta.por_cidade ?? []).filter((c) => c.cidade).sort((a, b) => b.online - a.online);
  const notaOnline = porCidade.length > 0
    ? porCidade.slice(0, 3).map((c) => `${c.cidade} ${c.online}`).join(" · ")
    : aoVivo ? `${aoVivo.oferta.prontos} prontos a aceitar` : "";

  const hoje = new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Lisbon" });

  /*
    Alertas é um separador da Visão Geral (09/10/2026): a lista completa do que
    a fila "Precisa de ti" resume. Toda a gente o vê: cada alerta tem dono, e
    cada perfil só recebe os seus.
  */
  const TABS: TabDef[] = [
    { id: "resumo", label: "Hoje" },
    { id: "alertas", label: "Alertas", count: totalAlertas || undefined },
  ];
  // Os objetivos e os relatórios estão em Crescimento (12/10/2026).
  if (tab === "objetivos" || tab === "relatorios") {
    if (typeof window !== "undefined") window.location.replace("/crescimento?tab=objetivos");
  }

  return (
    <RouteGuard route="/">
      <div className="space-y-6">
        <WelcomeBanner />

        <PageHeader
          title="Hoje"
          subtitle={hoje.charAt(0).toUpperCase() + hoje.slice(1)}
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {/*
          Duas colunas a partir de ecrãs largos: a fila à esquerda (o que
          fazer) e os números à direita (como está o negócio). Empilhados, os
          números ficavam por baixo de sete linhas da fila e ninguém lá
          chegava -- as duas perguntas do ecrã têm de se ver de uma vez.
        */}
        {tab === "resumo" && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <PrecisaDeTi onVerTodos={() => setTab("alertas")} onTotal={setTotalAlertas} />

            <div className="space-y-6">
              {aoVivo && (
                <StatGroup
                  cols={2}
                  title={<>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                    </span>
                    Agora
                  </>}
                  aside={<Link href="/servicos" className="btn-ghost text-[13px] -mr-1.5">Ao vivo <ArrowRight className="h-3.5 w-3.5" /></Link>}
                >
                  <Stat label="À procura de técnico" value={String(aoVivo.a_procura.length)} tone={aoVivo.a_procura.length > 0 && aoVivo.oferta.prontos === 0 ? "mau" : undefined} />
                  <Stat label="Em curso" value={String(aoVivo.em_curso.length)} />
                  {aoVivo.agora?.agendados_hoje !== undefined
                    ? <Stat label="Agendados para hoje" value={String(aoVivo.agora.agendados_hoje)} />
                    : <Stat label="Técnicos prontos" value={String(aoVivo.oferta.prontos)} tone={aoVivo.oferta.prontos === 0 ? "mau" : undefined} />}
                  <Stat label="Técnicos online" value={String(aoVivo.oferta.online)} note={notaOnline} tone={aoVivo.oferta.online === 0 ? "mau" : undefined} />
                </StatGroup>
              )}

              <div>
                <StatGroup
                  cols={2}
                  title="Este mês"
                  aside={<Link href="/financeiro" className="btn-ghost text-[13px] -mr-1.5">Financeiro <ArrowRight className="h-3.5 w-3.5" /></Link>}
                >
                  {servidos && (
                    <Stat
                      label="Pedidos servidos"
                      info="Dos pedidos criados, quantos tiveram técnico e foram feitos. É o número que diz se o marketplace funciona: um pedido que ninguém aceita é um cliente perdido."
                      value={servidos.valor}
                      note={servidos.nota}
                      tone={servidos.zero ? "mau" : undefined}
                    />
                  )}
                  <Stat
                    label="GMV"
                    info="Tudo o que o Payshop cobrou este mês (pagamentos de 10 € ou mais; abaixo são testes). A seta compara com os mesmos dias do mês passado."
                    value={formatCurrency(gmvMes.value)}
                  >
                    <TrendIndicator value={gmvMes.changePercent} trend={gmvMes.trend} />
                  </Stat>
                  <Stat
                    label="Comissão Piquet"
                    info="A parte do GMV que fica para a Piquet (25%). A seta compara com os mesmos dias do mês passado."
                    value={formatCurrency(comissaoMes.value)}
                  >
                    <TrendIndicator value={comissaoMes.changePercent} trend={comissaoMes.trend} />
                  </Stat>
                  <Stat
                    label="Resultado"
                    info="Comissão do mês menos os custos imputados ao mês (equipa + média das faturas de fornecedores), contados até hoje."
                    value={resultado === null ? "—" : `${resultado >= 0 ? "+" : "−"}${formatCurrency(Math.abs(resultado))}`}
                    note={resultado === null
                      ? <>Sem custos registados. <Link href="/financeiro?tab=custos" className="link">Registar</Link></>
                      : `${formatCurrency(fin?.piquetRevenue ?? 0)} − ${formatCurrency(custosDoMes)} de custos`}
                    tone={resultado === null ? undefined : resultado >= 0 ? "bom" : "mau"}
                  />
                </StatGroup>
                <p className="mt-2 px-1 text-[13px] text-text-muted">
                  O ano, o CAC, o LTV e as lojas estão em{" "}
                  <Link href="/crescimento" className="link">Crescimento</Link>.
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === "alertas" && <AlertasPage embutido onTotal={setTotalAlertas} />}
      </div>
    </RouteGuard>
  );
}

/**
 * O separador vem do endereço (`useTabParam` → `useSearchParams`), e o Next
 * pede um limite de Suspense por cima para compilar a página estática.
 */
export default function OverviewPage() {
  return (
    <Suspense>
      <OverviewPageInner />
    </Suspense>
  );
}
