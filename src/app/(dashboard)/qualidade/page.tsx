"use client";

import { useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { ShieldCheck } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/States";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useAsyncData } from "@/hooks/useDashboard";
import { getQuality, type Qualidade } from "@/services/extrasService";
import { getTechnicians } from "@/services/techniciansService";
import { buildMetricValue } from "@/lib/calculations";
import { formatDate, formatDateTime, formatPercent, formatCurrency } from "@/lib/formatters";
import { getVendorNoShows, declareVendorNoShow, type NoShowService } from "@/services/noShowsService";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import type { Technician } from "@/types";

/*
  ——— O que saiu deste ecrã ———

  - "NPS 62": não há inquérito de NPS em lado nenhum. O número estava escrito
    no código.
  - "Evolução da avaliação média": a série vinha de `4.3 + (i % 3) * 0.15`
    sobre os meses Jan–Jun. Desenhava uma tendência que nunca existiu.
  - "Distribuição de avaliações": quando não havia dados usava `star * 30`,
    o que dava sempre uma curva bonita a subir para as 5 estrelas.
  - "Reclamações recentes" e "Motivos de reclamação": não existe sistema de
    reclamações. Os motivos e as percentagens estavam escritos à mão.
  - Aba "Indicadores": tempo médio de resolução (26h) e serviços reabertos (4)
    eram constantes no código.

  O que fica é o que existe: a nota que o cliente dá no fim do serviço
  (`rating_by_customer`), os técnicos com média baixa, e as faltas — essas
  sempre foram reais.
*/

export default function QualityPage() {
  const [tab, setTab] = useState("visao");
  const { data: q, loading, error } = useAsyncData(() => getQuality(), []);
  const { data: techs } = useAsyncData(() => getTechnicians(1, 100), []);

  // Faltas de técnicos — endpoint real do Laravel, sem mock: isto tira
  // dinheiro a pessoas, e uma lista inventada seria um botão que "funciona"
  // sem fazer nada.
  const { data: noShows, refetch: refetchNoShows } = useAsyncData(() => getVendorNoShows(), []);
  const [declaringId, setDeclaringId] = useState<number | null>(null);
  const declareNow = async (r: NoShowService) => {
    const custo = formatCurrency(r.penalty_if_declared / 100);
    if (!confirm(`Dar o serviço #${r.service_id} como falta de ${r.vendor.name ?? "este técnico"}?\n\nIsto cobra-lhe ${custo} (metade do que ia receber), cancela o serviço e reembolsa o cliente. O técnico é notificado com o valor. Não se desfaz.`)) return;
    setDeclaringId(r.service_id);
    try {
      const res = await declareVendorNoShow(r.service_id);
      toast(`Falta registada — ${formatCurrency(res.service.penalty / 100)} cobrados a ${r.vendor.name ?? "técnico"}.`);
      refetchNoShows();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível registar a falta.", "error");
    } finally {
      setDeclaringId(null);
    }
  };

  const lowRated = (techs?.data ?? [])
    .filter((t) => t.averageRating > 0 && t.averageRating < 4)
    .sort((a, b) => a.averageRating - b.averageRating);
  const below3 = lowRated.filter((t) => t.averageRating < 3).length;

  const TABS: TabDef[] = [
    { id: "visao", label: "Avaliações" },
    { id: "baixa", label: "Baixa avaliação", count: lowRated.length },
    { id: "faltas", label: "Faltas", count: noShows?.suspected.length || undefined },
  ];

  const when = (r: NoShowService) => r.scheduled_day
    ? `${formatDate(r.scheduled_day)}${r.scheduled_time ? ` · ${r.scheduled_time.slice(0, 5)}` : ""}`
    : "—";

  const suspectedColumns: Column<NoShowService>[] = [
    { key: "service_id", label: "Serviço", render: (r) => <span className="font-mono text-xs">#{r.service_id}</span> },
    { key: "service_type", label: "Tipo", render: (r) => <span className="font-medium">{r.service_type ?? "—"}</span> },
    { key: "when", label: "Marcado para", render: when },
    { key: "vendor", label: "Técnico", render: (r) => (
      <div><div className="font-medium">{r.vendor.name ?? "—"}</div><div className="text-xs text-text-muted">{r.vendor.phone_number ?? ""}</div></div>
    ) },
    { key: "customer", label: "Cliente", render: (r) => (
      <div><div>{r.customer?.name ?? "—"}</div><div className="text-xs text-text-muted">{r.customer?.phone_number ?? ""}</div></div>
    ) },
    { key: "on_the_way", label: "A caminho?", render: (r) => r.on_the_way_at
      ? <span className="text-warning">{formatDateTime(r.on_the_way_at)}</span>
      : <span className="text-danger font-medium">Nunca saiu</span> },
    { key: "penalty", label: "Penalização", render: (r) => <span className="whitespace-nowrap font-semibold">{formatCurrency(r.penalty_if_declared / 100)}</span> },
    { key: "acao", label: "", render: (r) => (
      <button
        disabled={declaringId === r.service_id}
        onClick={() => declareNow(r)}
        className="btn-primary text-xs py-1 disabled:opacity-50 whitespace-nowrap"
      >
        {declaringId === r.service_id ? "A registar…" : "Dar como falta"}
      </button>
    ) },
  ];

  const declaredColumns: Column<NoShowService>[] = [
    { key: "service_id", label: "Serviço", render: (r) => <span className="font-mono text-xs">#{r.service_id}</span> },
    { key: "service_type", label: "Tipo", render: (r) => <span className="font-medium">{r.service_type ?? "—"}</span> },
    { key: "when", label: "Marcado para", render: when },
    { key: "vendor", label: "Técnico", render: (r) => r.vendor.name ?? "—" },
    { key: "customer", label: "Cliente", render: (r) => r.customer?.name ?? "—" },
    { key: "declared", label: "Declarada em", render: (r) => r.vendor_no_show_at ? formatDateTime(r.vendor_no_show_at) : "—" },
    { key: "penalty", label: "Cobrado", render: (r) => <span className="whitespace-nowrap font-semibold text-danger">{formatCurrency((r.vendor_no_show_penalty ?? 0) / 100)}</span> },
  ];

  const lowRatedColumns: Column<Technician>[] = [
    { key: "name", label: "Técnico", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "city", label: "Zona" },
    { key: "categories", label: "Categorias", render: (r) => r.categories.slice(0, 2).join(", ") },
    { key: "servicesCompleted", label: "Serviços" },
    { key: "averageRating", label: "Avaliação", render: (r) => (
      <span className={cn("font-semibold", r.averageRating < 3 ? "text-danger" : "text-warning")}>{r.averageRating}★</span>
    ) },
    { key: "cancellationRate", label: "Cancelamento", render: (r) => formatPercent(r.cancellationRate) },
  ];

  const insatisfeitosColumns: Column<Qualidade["insatisfeitos"][number]>[] = [
    { key: "id", label: "Serviço", render: (r) => <span className="font-mono text-xs">#{r.id}</span> },
    { key: "nota", label: "Nota", render: (r) => (
      <span className={cn("font-semibold", r.nota <= 1 ? "text-danger" : "text-warning")}>{r.nota}★</span>
    ) },
    { key: "tecnico", label: "Técnico", render: (r) => r.tecnico ?? "—" },
    { key: "cliente", label: "Cliente", render: (r) => r.cliente ?? "—" },
    { key: "categoria", label: "Categoria", render: (r) => r.categoria ?? "—" },
    { key: "quando", label: "Quando", render: (r) => (r.quando ? formatDate(r.quando) : "—") },
  ];

  return (
    <RouteGuard route="/qualidade">
      <div className="space-y-6">
        <PageHeader
          icon={ShieldCheck}
          eyebrow="Operação"
          title="Qualidade"
          subtitle="O que os clientes disseram, e quem faltou"
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "visao" && (
          <div className="space-y-6">
            {error && (
              <div className="rounded-xl border-l-[3px] border-l-danger bg-danger-light/40 px-4 py-3">
                <p className="text-sm font-semibold text-danger">Não foi possível ler as avaliações</p>
                <p className="text-xs text-text-secondary mt-0.5">{error}</p>
              </div>
            )}

            {loading && !q && <LoadingState />}

            {q && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="card p-4">
                    <p className="text-xs text-text-secondary">Avaliação média</p>
                    <p className="text-2xl font-bold text-text-primary tabular-nums">
                      {q.media == null ? "—" : `${q.media.toFixed(2).replace(".", ",")}★`}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {q.avaliados > 0 ? `de ${q.avaliados} avaliações` : "ainda sem avaliações"}
                    </p>
                  </div>
                  <div className="card p-4">
                    <p className="text-xs text-text-secondary">Serviços concluídos</p>
                    <p className="text-2xl font-bold text-text-primary tabular-nums">{q.concluidos}</p>
                    <p className="text-[11px] text-text-muted">no histórico todo</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-xs text-text-secondary">Avaliados</p>
                    <p className="text-2xl font-bold text-text-primary tabular-nums">
                      {q.concluidos > 0 ? `${Math.round((q.avaliados / q.concluidos) * 100)}%` : "—"}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {q.concluidos - q.avaliados} sem nota do cliente
                    </p>
                  </div>
                  <div className={cn("card p-4", q.insatisfeitos.length > 0 && "border-l-[3px] border-l-danger")}>
                    <p className="text-xs text-text-secondary">1 ou 2 estrelas</p>
                    <p className={cn("text-2xl font-bold tabular-nums", q.insatisfeitos.length > 0 ? "text-danger" : "text-text-primary")}>
                      {q.insatisfeitos.length}
                    </p>
                    <p className="text-[11px] text-text-muted">clientes a quem correu mal</p>
                  </div>
                </div>

                {/* Distribuição: barras simples, para zero ser visivelmente zero. */}
                <div className="card p-4 space-y-3">
                  <SectionHeader title="Como avaliaram" />
                  {q.avaliados === 0 ? (
                    <p className="py-4 text-center text-sm text-text-muted">
                      Ainda ninguém avaliou um serviço. Não há média a mostrar — e inventar uma seria pior.
                    </p>
                  ) : (
                    [...q.distribuicao].reverse().map((d) => (
                      <div key={d.estrelas}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="font-medium text-text-primary">{d.estrelas}★</span>
                          <span className="tabular-nums text-text-secondary">
                            {d.quantos} ({q.avaliados > 0 ? Math.round((d.quantos / q.avaliados) * 100) : 0}%)
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-surface-subtle overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", d.estrelas <= 2 ? "bg-danger" : d.estrelas === 3 ? "bg-warning" : "bg-success")}
                            style={{ width: `${q.avaliados > 0 ? (d.quantos / q.avaliados) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {q.porMes.length > 0 && (
                  <div>
                    <SectionHeader title="Mês a mês" />
                    <p className="text-xs text-text-secondary -mt-1 mb-3">
                      Só aparecem meses com avaliações. Um mês a zero seria lido como uma queda, quando o que houve foi silêncio.
                    </p>
                    <DataTable
                      columns={[
                        { key: "mes", label: "Mês" },
                        { key: "media", label: "Média", render: (m: Qualidade["porMes"][number]) => `${m.media.toFixed(2).replace(".", ",")}★` },
                        { key: "avaliados", label: "Avaliações" },
                      ]}
                      data={q.porMes}
                      keyField="mes"
                    />
                  </div>
                )}

                {q.insatisfeitos.length > 0 && (
                  <div>
                    <SectionHeader title="A quem correu mal" />
                    <p className="text-xs text-text-secondary -mt-1 mb-3">
                      Uma ou duas estrelas, do mais recente para trás. São estes os clientes que vale a pena contactar.
                    </p>
                    <DataTable columns={insatisfeitosColumns} data={q.insatisfeitos} keyField="id" />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "baixa" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard title="Abaixo de 4★" metric={buildMetricValue(lowRated.length, lowRated.length)} hideDelta />
              <MetricCard title="Abaixo de 3★" metric={buildMetricValue(below3, below3)} hideDelta />
              <MetricCard title="Serviços com 1 ou 2★" metric={buildMetricValue(q?.insatisfeitos.length ?? 0, q?.insatisfeitos.length ?? 0)} hideDelta />
            </div>
            <p className="text-sm text-text-secondary">
              Técnicos com avaliação abaixo de 4 estrelas — candidatos a formação, acompanhamento ou suspensão.
              A média de cada um vem do Laravel, calculada sobre as notas reais dos clientes.
            </p>
            <DataTable columns={lowRatedColumns} data={lowRated} keyField="id" emptyMessage="Nenhum técnico abaixo de 4★ 🎉" />
          </div>
        )}

        {tab === "faltas" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard title="Suspeitas por rever" metric={buildMetricValue(noShows?.suspected.length ?? 0, noShows?.suspected.length ?? 0)} hideDelta />
              <MetricCard title="Faltas declaradas" metric={buildMetricValue(noShows?.declared.length ?? 0, noShows?.declared.length ?? 0)} hideDelta />
              <MetricCard title="Penalização" metric={buildMetricValue(Math.round((noShows?.penalty_ratio ?? 0.5) * 100), Math.round((noShows?.penalty_ratio ?? 0.5) * 100))} hideDelta format="percent" />
            </div>

            <div>
              <h3 className="font-semibold mb-1">Suspeitas de falta</h3>
              <p className="text-sm text-text-secondary mb-3">
                Serviços cuja hora passou e o técnico nunca marcou &quot;Cheguei&quot; (últimos 7 dias). Antes de dar como falta, liga ao técnico e ao cliente:
                metade destes casos é o cliente que não estava em casa ou uma morada errada — e a penalização não se desfaz.
              </p>
              <DataTable columns={suspectedColumns} data={noShows?.suspected ?? []} keyField="service_id" emptyMessage="Nenhuma suspeita por rever 🎉" />
            </div>

            <div>
              <h3 className="font-semibold mb-1">Faltas declaradas</h3>
              <p className="text-sm text-text-secondary mb-3">
                O técnico foi cobrado em metade do que ia receber, o serviço cancelado e o cliente reembolsado. As contestações chegam como tickets em <Link href="/suporte" className="text-piquet-700 hover:underline">Suporte</Link>, com o número do serviço no assunto.
              </p>
              <DataTable columns={declaredColumns} data={noShows?.declared ?? []} keyField="service_id" emptyMessage="Sem faltas declaradas" />
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
