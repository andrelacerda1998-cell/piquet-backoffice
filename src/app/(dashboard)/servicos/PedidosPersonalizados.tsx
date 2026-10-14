"use client";

import { useState } from "react";
import { pedidoHref } from "@/lib/fichas";
import Link from "next/link";
import { Segmentado } from "@/components/ui/Segmentado";
import { ListaDeDados } from "@/components/ui/Ficha";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useDashboard";
import { getCustomRequests, type CustomRequest, type CustomRequestStatus } from "@/services/extrasService";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { X, ArrowRight, Send } from "lucide-react";
import { useAuthStore } from "@/stores";
import { hasPermission } from "@/lib/permissions";
import { DespacharPersonalizado } from "@/components/ui/DespacharPersonalizado";

/*
  Pedidos personalizados, como existem de verdade.

  O ecrã anterior desenhava um fluxo que não existe: a Piquet escolhia 3
  técnicos com preço fixo e "enviava 3 opções para a app do cliente". O botão
  mostrava "3 opções enviadas" e nada saía do browser; havia até um "Simular
  escolha do cliente". O fluxo real é outro: o pedido nasce À ESPERA DA
  PIQUET, alguém define a duração e as categorias e a partir daí é um pedido
  como os outros, com matching normal.

  Desde 09/10/2026 despacha-se daqui (backend #165), com o mesmo botão que
  está na ficha do pedido.
*/

/** O estado como etiqueta: o mesmo desenho do estado dos pedidos (ponto + nome). */
function Estado({ s }: { s: CustomRequestStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", ESTADO[s].tone)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ESTADO[s].label}
    </span>
  );
}

const ESTADO: Record<CustomRequestStatus, { label: string; tone: string; nota: string }> = {
  novo: { label: "À espera da Piquet", tone: "bg-danger-light text-danger", nota: "Falta definir a duração e as categorias. Até lá o cliente vê \"Pedido em análise\"." },
  em_analise: { label: "À procura de técnico", tone: "bg-info-light text-info", nota: "Já foi despachado e está no matching normal." },
  opcoes_enviadas: { label: "Em curso", tone: "bg-warning-light text-warning", nota: "Aceite por um técnico: à espera de pagamento, agendado ou a decorrer." },
  agendado: { label: "Concluído", tone: "bg-success-light text-success", nota: "O serviço foi feito." },
  recusado: { label: "Sem serviço", tone: "bg-surface-subtle text-text-muted", nota: "Falhou, expirou ou foi cancelado." },
};

export default function PedidosPersonalizados() {
  const { data, loading, error, refetch } = useAsyncData(() => getCustomRequests(), []);
  const [tab, setTab] = useState<"todos" | CustomRequestStatus>("todos");
  const [aberto, setAberto] = useState<CustomRequest | null>(null);
  const [aDespachar, setADespachar] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const podeDespachar = !!role && hasPermission(role, "edit_services");

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const pedidos = data ?? [];
  const conta = (s: CustomRequestStatus) => pedidos.filter((r) => r.status === s).length;
  const OPCOES = [
    { id: "todos" as const, label: "Todos", count: pedidos.length },
    ...(Object.keys(ESTADO) as CustomRequestStatus[]).map((s) => ({
      id: s, label: ESTADO[s].label, count: conta(s), tom: s === "novo" && conta(s) > 0 ? ("alerta" as const) : undefined,
    })),
  ];
  const visiveis = pedidos.filter((r) => tab === "todos" || r.status === tab);

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-text-muted max-w-3xl">
        O cliente descreve o trabalho na app. Fica <b className="font-medium text-text-primary">à espera da Piquet</b> até alguém
        definir a duração e as categorias (botão <b className="font-medium text-text-primary">Despachar</b>); depois segue o matching normal.
      </p>

      <div className="overflow-x-auto -mx-1 px-1">
        <Segmentado ariaLabel="Estado dos pedidos personalizados" opcoes={OPCOES} valor={tab} onChange={setTab} />
      </div>

      {visiveis.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-text-muted">{tab === "todos" ? "Ainda não há pedidos personalizados." : "Nenhum pedido personalizado neste estado."}</p>
      ) : (
        <ul className="card divide-y divide-surface-border">
          {visiveis.map((r) => (
            <li key={r.id}>
              <button onClick={() => setAberto(r)} className="w-full flex items-start gap-4 px-4 py-3 text-left hover:bg-surface-subtle/60 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {r.customerName} <span className="font-normal text-text-muted">· #{r.id} · {r.category} · {r.city || "—"}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-text-secondary line-clamp-1">{r.description || "Sem descrição."}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Estado s={r.status} />
                  <span className="text-xs text-text-muted">
                    {r.photosCount ? `${r.photosCount} ${r.photosCount === 1 ? "foto" : "fotos"} · ` : ""}{r.createdAt ? formatDate(r.createdAt) : ""}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setAberto(null)}>
          <div role="dialog" aria-modal="true" aria-label={`Pedido personalizado ${aberto.id}`}
            className="w-full max-w-lg bg-surface h-full overflow-y-auto shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface border-b border-surface-border px-6 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-text-muted">Pedido personalizado #{aberto.id}</p>
                <h2 className="text-xl font-semibold tracking-tight mt-0.5">{aberto.customerName}</h2>
                <p className="text-[13px] text-text-muted">{aberto.category} · {aberto.city || "—"}{aberto.phone ? ` · ${aberto.phone}` : ""}</p>
              </div>
              <button onClick={() => setAberto(null)} className="btn-ghost p-1.5 -mr-1.5" aria-label="Fechar"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-1.5">
                <Estado s={aberto.status} />
                <p className="text-[13px] text-text-secondary">{ESTADO[aberto.status].nota}</p>
              </div>
              <section>
                <h3 className="text-sm font-semibold text-text-primary mb-2">O que o cliente pediu</h3>
                <p className="text-sm text-text-primary whitespace-pre-line">{aberto.description || "Sem descrição."}</p>
              </section>
              <ListaDeDados linhas={[
                ["Recebido", aberto.createdAt ? formatDate(aberto.createdAt) : "—"],
                ["Duração definida", aberto.estimatedHours != null ? `${aberto.estimatedHours} h` : "Ainda não"],
                ["Fotografias", String(aberto.photosCount ?? 0)],
              ]} />
              <div className="flex flex-wrap gap-2">
                {aberto.status === "novo" && podeDespachar && (
                  <button onClick={() => setADespachar(true)} className="btn-primary text-sm inline-flex">
                    <Send className="h-4 w-4" /> Despachar
                  </button>
                )}
                <Link href={pedidoHref(aberto.id)} className="btn-secondary text-sm inline-flex">
                  Abrir o pedido completo <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <DespacharPersonalizado
                open={aDespachar}
                onClose={() => setADespachar(false)}
                servicoId={aberto.id}
                descricao={aberto.description || null}
                categoriasDoCliente={aberto.category.split(" · ").filter((c) => c !== "Por classificar")}
                onDespachado={() => { setAberto(null); refetch(); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
