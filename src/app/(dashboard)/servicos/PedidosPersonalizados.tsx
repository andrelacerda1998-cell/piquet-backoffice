"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getCustomRequests, type CustomRequest, type CustomRequestStatus } from "@/services/extrasService";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { X, ArrowRight } from "lucide-react";

/*
  Pedidos personalizados, como existem de verdade.

  O ecrã anterior desenhava um fluxo que não existe: a Piquet escolhia 3
  técnicos com preço fixo e "enviava 3 opções para a app do cliente". O botão
  mostrava "3 opções enviadas" e nada saía do browser; havia até um "Simular
  escolha do cliente". O fluxo real é outro: o pedido nasce À ESPERA DA
  PIQUET, alguém define a duração e as áreas (hoje só no Filament) e a partir
  daí é um pedido como os outros, com matching normal.

  Por isso isto é só de leitura: diz o que entrou, em que ponto está e leva
  ao pedido completo.
*/

const ESTADO: Record<CustomRequestStatus, { label: string; tone: string; nota: string }> = {
  novo: { label: "À espera da Piquet", tone: "bg-danger-light text-danger", nota: "Falta definir a duração e as áreas (no Filament). Até lá o cliente vê \"Pedido em análise\"." },
  em_analise: { label: "À procura de profissional", tone: "bg-info-light text-info", nota: "Já foi despachado e está no matching normal." },
  opcoes_enviadas: { label: "Em curso", tone: "bg-warning-light text-warning", nota: "Aceite por um profissional: à espera de pagamento, agendado ou a decorrer." },
  agendado: { label: "Concluído", tone: "bg-success-light text-success", nota: "O serviço foi feito." },
  recusado: { label: "Sem serviço", tone: "bg-surface-subtle text-text-muted", nota: "Falhou, expirou ou foi cancelado." },
};

export default function PedidosPersonalizados() {
  const { data, loading, error, refetch } = useAsyncData(() => getCustomRequests(), []);
  const [tab, setTab] = useState<"todos" | CustomRequestStatus>("todos");
  const [aberto, setAberto] = useState<CustomRequest | null>(null);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const pedidos = data ?? [];
  const conta = (s: CustomRequestStatus) => pedidos.filter((r) => r.status === s).length;
  const TABS: TabDef[] = [
    { id: "todos", label: "Todos", count: pedidos.length },
    ...(Object.keys(ESTADO) as CustomRequestStatus[]).map((s) => ({ id: s, label: ESTADO[s].label, count: conta(s) || undefined })),
  ];
  const visiveis = pedidos.filter((r) => tab === "todos" || r.status === tab);

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary max-w-3xl">
        O cliente descreve o trabalho na app. Fica <b className="text-text-primary">à espera da Piquet</b> até alguém
        definir a duração e as áreas; depois segue o matching normal. A definição faz-se por agora no Filament.
      </p>

      <Tabs tabs={TABS} active={tab} onChange={(t) => setTab(t as typeof tab)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visiveis.map((r) => (
          <button key={r.id} onClick={() => setAberto(r)} className="card p-4 text-left hover:shadow-elevated transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-text-primary truncate">{r.customerName}</p>
                <p className="text-xs text-text-secondary">#{r.id} · {r.category} · {r.city || "—"}</p>
              </div>
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0", ESTADO[r.status].tone)}>{ESTADO[r.status].label}</span>
            </div>
            <p className="mt-2 text-sm text-text-secondary line-clamp-2">{r.description || "Sem descrição."}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
              <span>{r.photosCount ? `${r.photosCount} ${r.photosCount === 1 ? "foto" : "fotos"}` : "Sem fotos"}</span>
              <span>{r.createdAt ? formatDate(r.createdAt) : ""}</span>
            </div>
          </button>
        ))}
        {visiveis.length === 0 && <p className="text-sm text-text-muted">Sem pedidos personalizados {tab === "todos" ? "" : "neste estado"}.</p>}
      </div>

      {aberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setAberto(null)}>
          <div role="dialog" aria-modal="true" aria-label={`Pedido personalizado ${aberto.id}`}
            className="w-full max-w-lg bg-surface h-full overflow-y-auto shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface border-b border-surface-border px-6 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-text-muted">#{aberto.id}</p>
                <h2 className="text-lg font-bold mt-0.5">{aberto.customerName}</h2>
                <p className="text-sm text-text-secondary">{aberto.category} · {aberto.city || "—"}{aberto.phone ? ` · ${aberto.phone}` : ""}</p>
              </div>
              <button onClick={() => setAberto(null)} className="p-1 hover:bg-surface-muted rounded" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="rounded-lg bg-surface-subtle px-3 py-2 text-sm">
                <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium mr-2", ESTADO[aberto.status].tone)}>{ESTADO[aberto.status].label}</span>
                <span className="text-text-secondary">{ESTADO[aberto.status].nota}</span>
              </div>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">O que o cliente pediu</h3>
                <p className="text-sm text-text-primary whitespace-pre-line">{aberto.description || "Sem descrição."}</p>
              </section>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-text-muted">Recebido</dt><dd>{aberto.createdAt ? formatDate(aberto.createdAt) : "—"}</dd></div>
                <div><dt className="text-text-muted">Duração definida</dt><dd>{aberto.estimatedHours != null ? `${aberto.estimatedHours} h` : "Ainda não"}</dd></div>
                <div><dt className="text-text-muted">Fotografias</dt><dd>{aberto.photosCount ?? 0}</dd></div>
              </dl>
              <Link href={`/servicos?servico=${encodeURIComponent(aberto.id)}`} className="btn-primary text-sm inline-flex">
                Abrir o pedido completo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
