"use client";

import { useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";

import { StatGroup, Stat } from "@/components/ui/Stats";
import { Painel } from "@/components/ui/Painel";
import { Barra } from "@/components/ui/Barra";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/States";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useAsyncData } from "@/hooks/useDashboard";
import { getQuality, type Qualidade } from "@/services/extrasService";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime, formatCurrency, formatRating } from "@/lib/formatters";
import { getVendorNoShows, declareVendorNoShow, type NoShowService } from "@/services/noShowsService";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MOTIVO_MINIMO } from "@/lib/motivo";

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

/** O número do pedido, que abre o pedido. */
function IdDoPedido({ id }: { id: number }) {
  return (
    <Link href={`/servicos/${id}`} onClick={(e) => e.stopPropagation()}
      className="font-mono text-xs text-text-secondary hover:text-text-primary hover:underline">
      #{id}
    </Link>
  );
}

export default function QualityPage() {
  const [tab, setTab] = useState("visao");
  const router = useRouter();
  const { data: q, loading, error } = useAsyncData(() => getQuality(), []);

  // Faltas de técnicos — endpoint real do Laravel, sem mock: isto tira
  // dinheiro a pessoas, e uma lista inventada seria um botão que "funciona"
  // sem fazer nada.
  const { data: noShows, refetch: refetchNoShows } = useAsyncData(() => getVendorNoShows(), []);
  const [declaringId, setDeclaringId] = useState<number | null>(null);
  // A falta a confirmar: abre o diálogo com o valor e pede o motivo.
  const [aDeclarar, setADeclarar] = useState<NoShowService | null>(null);
  const declareNow = async (r: NoShowService, motivo: string) => {
    setDeclaringId(r.service_id);
    try {
      const res = await declareVendorNoShow(r.service_id, motivo);
      toast(`Falta registada — ${formatCurrency(res.service.penalty / 100)} cobrados a ${r.vendor.name ?? "técnico"}.`);
      setADeclarar(null);
      refetchNoShows();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível registar a falta.", "error");
    } finally {
      setDeclaringId(null);
    }
  };

  /*
    Vinha de getTechnicians(), que lê `/technicians/legacy-mock`: a lista de
    "técnicos abaixo de 4 estrelas" nomeava pessoas que não existem, com
    médias inventadas. Agora sai das notas reais dos serviços deles.
  */
  const lowRated = (q?.porTecnico ?? []).filter((t) => t.media < 4);
  const below3 = lowRated.filter((t) => t.media < 3).length;

  const TABS: TabDef[] = [
    { id: "visao", label: "Avaliações" },
    { id: "baixa", label: "Baixa avaliação", count: lowRated.length },
    { id: "faltas", label: "Faltas", count: noShows?.suspected.length || undefined },
  ];

  const when = (r: NoShowService) => r.scheduled_day
    ? `${formatDate(r.scheduled_day)}${r.scheduled_time ? ` · ${r.scheduled_time.slice(0, 5)}` : ""}`
    : "—";

  const suspectedColumns: Column<NoShowService>[] = [
    { key: "service_id", label: "Serviço", render: (r) => <IdDoPedido id={r.service_id} /> },
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
    { key: "penalty", label: "Penalização", className: "text-right", render: (r) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(r.penalty_if_declared / 100)}</span> },
    { key: "acao", label: "", render: (r) => (
      <button
        disabled={declaringId === r.service_id}
        onClick={() => setADeclarar(r)}
        className="btn-secondary text-xs px-2.5 py-1 disabled:opacity-50 whitespace-nowrap"
      >
        {declaringId === r.service_id ? "A registar…" : "Dar como falta"}
      </button>
    ) },
  ];

  const declaredColumns: Column<NoShowService>[] = [
    { key: "service_id", label: "Serviço", render: (r) => <IdDoPedido id={r.service_id} /> },
    { key: "service_type", label: "Tipo", render: (r) => <span className="font-medium">{r.service_type ?? "—"}</span> },
    { key: "when", label: "Marcado para", render: when },
    { key: "vendor", label: "Técnico", render: (r) => r.vendor.name ?? "—" },
    { key: "customer", label: "Cliente", render: (r) => r.customer?.name ?? "—" },
    { key: "declared", label: "Declarada em", render: (r) => r.vendor_no_show_at ? formatDateTime(r.vendor_no_show_at) : "—" },
    { key: "penalty", label: "Cobrado", className: "text-right", render: (r) => <span className="whitespace-nowrap font-semibold tabular-nums text-danger">{formatCurrency((r.vendor_no_show_penalty ?? 0) / 100)}</span> },
  ];

  const lowRatedColumns: Column<Qualidade["porTecnico"][number]>[] = [
    { key: "nome", label: "Técnico", render: (r) => <span className="font-medium">{r.nome}</span> },
    { key: "media", label: "Média", render: (r) => (
      <span className={cn("font-semibold tabular-nums", r.media < 3 ? "text-danger" : "text-warning")}>
        {formatRating(r.media)} ★
      </span>
    ) },
    { key: "avaliacoes", label: "Avaliações", render: (r) => (
      // Sem isto, "2,0★" de uma avaliação lia-se igual a "2,0★" de trinta.
      <span className="tabular-nums" title="Quantos clientes o avaliaram">{r.avaliacoes}</span>
    ) },
    { key: "fracas", label: "1 ou 2★", render: (r) => <span className="tabular-nums">{r.fracas}</span> },
  ];

  const insatisfeitosColumns: Column<Qualidade["insatisfeitos"][number]>[] = [
    { key: "id", label: "Serviço", render: (r) => <span className="font-mono text-xs text-text-secondary">#{r.id}</span> },
    { key: "nota", label: "Nota", render: (r) => (
      <span className={cn("font-semibold", r.nota <= 1 ? "text-danger" : "text-warning")}>{r.nota} ★</span>
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
          title="Qualidade"
          subtitle="O que os clientes disseram, e quem faltou"
        />

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "visao" && (
          <div className="space-y-6">
            {error && (
              <div className="aviso aviso-perigo">
                <p className="font-medium">Não foi possível ler as avaliações</p>
                <p className="text-xs text-text-secondary mt-0.5">{error}</p>
              </div>
            )}

            {loading && !q && <LoadingState />}

            {q && (
              <>
                <StatGroup cols={4}>
                  <Stat label="Avaliação média" value={q.media == null ? "—" : `${formatRating(q.media)} ★`}
                    note={q.avaliados > 0 ? `de ${q.avaliados} avaliações` : "ainda sem avaliações"} />
                  <Stat label="Serviços concluídos" value={q.concluidos} note="no histórico todo" />
                  <Stat label="Avaliados" value={q.concluidos > 0 ? `${Math.round((q.avaliados / q.concluidos) * 100)}%` : "—"}
                    note={`${q.concluidos - q.avaliados} sem nota do cliente`} />
                  <Stat label="1 ou 2 estrelas" value={q.insatisfeitos.length} tone={q.insatisfeitos.length > 0 ? "mau" : undefined}
                    note="clientes a quem correu mal" />
                </StatGroup>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Distribuição: barras simples, para zero ser visivelmente zero. */}
                  <Painel titulo="Como avaliaram" corpo="p-4 space-y-3">
                    {q.avaliados === 0 ? (
                      <p className="py-4 text-center text-sm text-text-muted">
                        Ainda ninguém avaliou um serviço. Não há média a mostrar — e inventar uma seria pior.
                      </p>
                    ) : (
                      [...q.distribuicao].reverse().map((d) => (
                        <Barra key={d.estrelas} nome={`${d.estrelas} ★`}
                          valor={<>{d.quantos} <span className="text-text-muted">({Math.round((d.quantos / q.avaliados) * 100)}%)</span></>}
                          largura={(d.quantos / q.avaliados) * 100}
                          cor={d.estrelas <= 2 ? "bg-danger/80" : d.estrelas === 3 ? "bg-piquet/50" : "bg-success/80"} />
                      ))
                    )}
                  </Painel>

                  {/* Só meses com avaliações: um mês a zero seria lido como uma
                      queda, quando o que houve foi silêncio. */}
                  <Painel titulo="Mês a mês" descricao="Só aparecem meses com avaliações" corpo="">
                    {q.porMes.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-text-muted">Sem avaliações ainda.</p>
                    ) : (
                      <ul className="divide-y divide-surface-border">
                        {q.porMes.map((m) => (
                          <li key={m.mes} className="flex items-baseline justify-between gap-3 px-4 py-2 text-[13px]">
                            <span className="text-text-secondary">{m.mes}</span>
                            <span className="tabular-nums">
                              <span className="font-semibold text-text-primary">{formatRating(m.media)} ★</span>
                              <span className="text-text-muted"> · {m.avaliados} avaliaç{m.avaliados === 1 ? "ão" : "ões"}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Painel>
                </div>

                {q.insatisfeitos.length > 0 && (
                  <section>
                    <SectionHeader title="A quem correu mal"
                      description="Uma ou duas estrelas, do mais recente para trás. São estes os clientes que vale a pena contactar." />
                    <DataTable columns={insatisfeitosColumns} data={q.insatisfeitos} keyField="id"
                      onRowClick={(r) => router.push(`/servicos/${r.id}`)} />
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {tab === "baixa" && (
          <div className="space-y-4">
            <StatGroup cols={3}>
              <Stat label="Abaixo de 4 ★" value={lowRated.length} />
              <Stat label="Abaixo de 3 ★" value={below3} tone={below3 > 0 ? "mau" : undefined} />
              <Stat label="Serviços com 1 ou 2 ★" value={q?.insatisfeitos.length ?? 0} />
            </StatGroup>
            <p className="text-[13px] text-text-muted max-w-3xl">
              Técnicos com média abaixo de 4 estrelas — candidatos a formação, acompanhamento ou suspensão.
              A média sai das notas reais dos serviços de cada um. Repara sempre no número de avaliações antes de
              agir: duas estrelas de um cliente só não é o mesmo que duas estrelas de trinta.
            </p>
            <DataTable columns={lowRatedColumns} data={lowRated} keyField="nome" emptyMessage="Nenhum técnico abaixo de 4 ★ 🎉" />
          </div>
        )}

        {tab === "faltas" && (
          <div className="space-y-6">
            <StatGroup cols={3}>
              <Stat label="Suspeitas por rever" value={noShows?.suspected.length ?? 0}
                tone={(noShows?.suspected.length ?? 0) > 0 ? "mau" : undefined} />
              <Stat label="Faltas declaradas" value={noShows?.declared.length ?? 0} />
              <Stat label="Penalização" value={`${Math.round((noShows?.penalty_ratio ?? 0.5) * 100)}%`} note="do que o técnico ia receber" />
            </StatGroup>

            <section>
              <SectionHeader title="Suspeitas de falta" description={<>
                Serviços cuja hora passou e o técnico nunca marcou &quot;Cheguei&quot; (últimos 7 dias). Antes de dar como falta, liga ao técnico e ao cliente:
                metade destes casos é o cliente que não estava em casa ou uma morada errada — e a penalização não se desfaz.
              </>} />
              <DataTable columns={suspectedColumns} data={noShows?.suspected ?? []} keyField="service_id" emptyMessage="Nenhuma suspeita por rever 🎉" />
            </section>

            <section>
              <SectionHeader title="Faltas declaradas" description={<>
                O técnico foi cobrado em metade do que ia receber, o serviço cancelado e o cliente reembolsado. As contestações chegam como tickets em{" "}
                <Link href="/suporte" className="font-medium text-text-primary underline decoration-surface-strong underline-offset-2 hover:decoration-text-primary">Suporte</Link>, com o número do serviço no assunto.
              </>} />
              <DataTable columns={declaredColumns} data={noShows?.declared ?? []} keyField="service_id" emptyMessage="Sem faltas declaradas" />
            </section>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!aDeclarar}
        onClose={() => setADeclarar(null)}
        onConfirm={(motivo) => (aDeclarar && motivo ? declareNow(aDeclarar, motivo) : undefined)}
        tone="danger"
        title={aDeclarar ? `Dar o pedido #${aDeclarar.service_id} como falta?` : ""}
        description={aDeclarar && (
          <>
            Cobra a {aDeclarar.vendor.name ?? "este técnico"} <strong>{formatCurrency(aDeclarar.penalty_if_declared / 100)}</strong>{" "}
            (metade do que ia receber), cancela o pedido e devolve o dinheiro ao cliente. O técnico é avisado com o valor.
            Não se desfaz.
          </>
        )}
        confirmLabel="Dar como falta"
        requireReason
        minReason={MOTIVO_MINIMO}
        reasonLabel="Motivo (fica registado com o teu nome)"
        reasonPlaceholder="Ex.: o cliente ligou às 14:20 a dizer que ninguém apareceu"
        loading={declaringId !== null}
      />
    </RouteGuard>
  );
}
