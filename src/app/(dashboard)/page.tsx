"use client";

import { useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { WelcomeBanner } from "@/components/ui/WelcomeBanner";
import { TrendIndicator } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getFinanceGmv, getFinanceSummary } from "@/services/financeService";
import { getOperacoesAoVivo } from "@/services/dashboardService";
import { pct } from "@/lib/aoVivo";
import { PrecisaDeTi } from "@/components/hoje/PrecisaDeTi";
import { buildMetricValue } from "@/lib/calculations";
import { useAuthStore } from "@/stores";
import { hasAnyPermission } from "@/lib/permissions";
import type { Permission } from "@/types";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useTabParam } from "@/hooks/useTabParam";
import ObjetivosPage from "./objetivos/Objetivos";
import AlertasPage from "./alertas/Alertas";
import RelatoriosPage from "./relatorios/Relatorios";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { LayoutDashboard } from "lucide-react";

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

export default function OverviewPage() {
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

  // GMV e comissão: o cobrado no Payshop (ver api/_lib/gmv.ts).
  const gmvMes = buildMetricValue(gmvData?.month.gmv ?? 0, gmvData?.prevMonth.gmv ?? 0, false);
  const comissaoMes = buildMetricValue(gmvData?.month.commission ?? 0, gmvData?.prevMonth.commission ?? 0, false);

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
    ? { valor: pct(mes.taxa), nota: `${mes.servidos} de ${mes.criados} pedidos do mês`, zero: mes.criados > 0 && mes.servidos === 0 }
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
          title="Hoje"
          subtitle={hoje.charAt(0).toUpperCase() + hoje.slice(1)}
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "resumo" && (
          <div className="space-y-8">
            <PrecisaDeTi onVerTodos={() => setTab("alertas")} onTotal={setTotalAlertas} />

            {aoVivo && (
              <section aria-labelledby="agora">
                <p id="agora" className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Agora <Link href="/servicos" className="ml-2 normal-case tracking-normal font-normal text-piquet-600 hover:underline">Pedidos ao vivo →</Link>
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <AgoraCard titulo="À procura de técnico" valor={String(aoVivo.a_procura.length)} alerta={aoVivo.a_procura.length > 0 && aoVivo.oferta.prontos === 0} />
                  <AgoraCard titulo="Em curso" valor={String(aoVivo.em_curso.length)} />
                  {aoVivo.agora?.agendados_hoje !== undefined
                    ? <AgoraCard titulo="Agendados para hoje" valor={String(aoVivo.agora.agendados_hoje)} />
                    : <AgoraCard titulo="Técnicos prontos" valor={String(aoVivo.oferta.prontos)} alerta={aoVivo.oferta.prontos === 0} />}
                  <AgoraCard titulo="Técnicos online" valor={String(aoVivo.oferta.online)} nota={notaOnline} alerta={aoVivo.oferta.online === 0} />
                </div>
              </section>
            )}

            <section aria-labelledby="este-mes">
              <p id="este-mes" className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Este mês</p>
              <div className="card p-4 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                {servidos && (
                  <NumeroDoMes
                    titulo="Pedidos servidos"
                    info="Dos pedidos criados, quantos tiveram técnico e foram feitos. É o número que diz se o marketplace funciona: um pedido que ninguém aceita é um cliente perdido."
                    valor={servidos.valor}
                    nota={servidos.nota}
                    tom={servidos.zero ? "mau" : undefined}
                  />
                )}
                <NumeroDoMes
                  titulo="GMV"
                  info="Tudo o que o Payshop cobrou este mês (pagamentos de 10 € ou mais; abaixo são testes)."
                  valor={formatCurrency(gmvMes.value)}
                  extra={<TrendIndicator value={gmvMes.changePercent} trend={gmvMes.trend} />}
                />
                <NumeroDoMes
                  titulo="Comissão Piquet"
                  info="A parte do GMV que fica para a Piquet (25%)."
                  valor={formatCurrency(comissaoMes.value)}
                  extra={<TrendIndicator value={comissaoMes.changePercent} trend={comissaoMes.trend} />}
                />
                <NumeroDoMes
                  titulo="Resultado"
                  info="Comissão do mês menos os custos imputados ao mês (equipa + média das faturas de fornecedores), contados até hoje."
                  valor={resultado === null ? "—" : `${resultado >= 0 ? "+" : "−"}${formatCurrency(Math.abs(resultado))}`}
                  nota={resultado === null ? undefined : `${formatCurrency(fin?.piquetRevenue ?? 0)} − ${formatCurrency(custosDoMes)} de custos`}
                  tom={resultado === null ? undefined : resultado >= 0 ? "bom" : "mau"}
                  semValor={resultado === null ? <>Sem custos registados. <Link href="/financeiro?tab=custos" className="text-piquet-600 hover:underline">Registar</Link></> : undefined}
                />
              </div>
              <p className="mt-3 text-sm text-text-secondary">
                O ano, o CAC, o LTV, os downloads e a avaliação nas lojas estão em{" "}
                <Link href="/marketing" className="text-piquet-600 font-medium hover:underline">Crescimento</Link>;
                o detalhe do dinheiro no <Link href="/financeiro" className="text-piquet-600 font-medium hover:underline">Financeiro</Link>.
              </p>
            </section>
          </div>
        )}

        {tab === "alertas" && <AlertasPage embutido onTotal={setTotalAlertas} />}
        {tab === "objetivos" && <ObjetivosPage />}
        {tab === "relatorios" && <RelatoriosPage />}
      </div>
    </RouteGuard>
  );
}

/** Um número do bloco "Agora": vermelho quando pede ação. */
function AgoraCard({ titulo, valor, nota, alerta = false }: { titulo: string; valor: string; nota?: string; alerta?: boolean }) {
  return (
    <div className={cn("card p-3", alerta && "border-l-[3px] border-l-danger")}>
      <p className="text-xs text-text-secondary">{titulo}</p>
      <p className={cn("text-2xl font-bold tabular-nums", alerta ? "text-danger" : "text-text-primary")}>{valor}</p>
      {nota && <p className="text-[11px] text-text-muted truncate">{nota}</p>}
    </div>
  );
}

/** Um número da linha do mês, com a definição num "ⓘ" que abre com um toque. */
function NumeroDoMes({ titulo, info, valor, nota, extra, tom, semValor }: {
  titulo: string; info: string; valor: string; nota?: string; extra?: React.ReactNode;
  tom?: "bom" | "mau"; semValor?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-text-secondary">{titulo} <InfoTip texto={info} lado="esquerda" /></p>
      <p className={cn("mt-0.5 text-xl font-bold tabular-nums",
        tom === "bom" ? "text-success" : tom === "mau" ? "text-danger" : valor === "—" ? "text-text-muted" : "text-text-primary")}>
        {valor}
      </p>
      {extra && <div className="mt-0.5">{extra}</div>}
      {nota && <p className="text-[11px] text-text-muted truncate">{nota}</p>}
      {semValor && <p className="text-[11px] text-text-muted">{semValor}</p>}
    </div>
  );
}
