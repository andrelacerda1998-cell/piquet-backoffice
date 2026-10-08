import type { ServiceStatus } from "@/types";
import { SERVICE_STATUS_LABELS } from "@/config/dashboard";

/**
 * O histórico de um pedido, como o Laravel o grava (service_events, backend
 * #160) e o backoffice o conta. Só existe para pedidos a partir de 08/10/2026.
 */
export interface EventoDoPedido {
  tipo: "criado" | "estado" | "convidado" | "resposta" | "a_caminho" | string;
  de: string | null;
  para: string | null;
  /** O estado no vocabulário do backoffice (acrescentado pela rota). */
  deBackoffice?: ServiceStatus | null;
  paraBackoffice?: ServiceStatus | null;
  vendor_id: number | null;
  vendor_name: string | null;
  dados: Record<string, unknown> | null;
  em: string;
}

const RESPOSTAS: Record<string, string> = {
  accepted: "aceitou",
  declined: "recusou",
  expired: "não respondeu a tempo",
  selected: "foi escolhido pelo cliente",
  lost: "aceitou, mas o cliente escolheu outro",
};

const estado = (s: ServiceStatus | null | undefined, cru: string | null) =>
  (s && SERVICE_STATUS_LABELS[s]) || cru || "—";

/** Uma linha da cronologia: o que aconteceu, em português, e um pormenor. */
export function textoDoEvento(e: EventoDoPedido): { titulo: string; detalhe?: string } {
  const tecnico = e.vendor_name ?? (e.vendor_id ? `Técnico ${e.vendor_id}` : "Um técnico");
  const onda = typeof e.dados?.onda === "number" ? `onda ${e.dados.onda}` : null;
  switch (e.tipo) {
    case "criado":
      return { titulo: "Pedido criado", detalhe: estado(e.paraBackoffice, e.para) };
    case "estado":
      return { titulo: estado(e.paraBackoffice, e.para), detalhe: `antes: ${estado(e.deBackoffice, e.de)}` };
    case "convidado": {
      const km = typeof e.dados?.distancia_km === "number" ? `${String(e.dados.distancia_km).replace(".", ",")} km` : null;
      return { titulo: `${tecnico} foi convidado`, detalhe: [onda, km].filter(Boolean).join(" · ") || undefined };
    }
    case "resposta":
      return { titulo: `${tecnico} ${RESPOSTAS[e.para ?? ""] ?? `respondeu (${e.para})`}`, detalhe: onda ?? undefined };
    case "a_caminho":
      return { titulo: `${tecnico} saiu a caminho` };
    default:
      return { titulo: e.tipo };
  }
}

/** Do mais antigo para o mais recente, e com o tempo desde o passo anterior. */
export function comIntervalos(eventos: readonly EventoDoPedido[]): Array<EventoDoPedido & { segundosDesdeAnterior: number | null }> {
  const ord = [...eventos].sort((a, b) => Date.parse(a.em) - Date.parse(b.em));
  return ord.map((e, i) => ({
    ...e,
    segundosDesdeAnterior: i === 0 ? null : Math.max(0, Math.round((Date.parse(e.em) - Date.parse(ord[i - 1].em)) / 1000)),
  }));
}
