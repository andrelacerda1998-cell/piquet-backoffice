"use client";

import { useEffect, useState } from "react";
import { getLeadTimeline, type EventoPedido } from "@/services/extrasService";
import { formatDateTime } from "@/lib/formatters";
import { Clock } from "lucide-react";

/**
 * O que aconteceu a um pedido, por ordem.
 *
 * Só acontecimentos com data real. Mudar o estado à mão no backoffice não
 * deixa rasto -- não há tabela de histórico -- e deduzir "passou a Com
 * técnico" a partir do estado atual seria inventar um registo. Por isso um
 * pedido do site mostra uma linha só, e diz porquê.
 *
 * Acrescenta, não substitui: o estado, as notas e a conversa continuam onde
 * estavam.
 */
export function CronologiaPedido({ leadId }: { leadId: string }) {
  const [eventos, setEventos] = useState<EventoPedido[] | null>(null);
  const [completo, setCompleto] = useState(false);

  useEffect(() => {
    let vivo = true;
    getLeadTimeline(leadId)
      .then((r) => { if (vivo) { setEventos(r.eventos); setCompleto(r.completo); } })
      .catch(() => { if (vivo) setEventos([]); });
    return () => { vivo = false; };
  }, [leadId]);

  if (eventos === null) return <p className="text-xs text-text-muted">A carregar cronologia…</p>;
  if (eventos.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted mb-2 inline-flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" /> Cronologia
      </p>
      <ol className="space-y-2.5">
        {eventos.map((e, i) => (
          <li key={`${e.em}-${i}`} className="flex gap-3">
            {/* Linha vertical entre pontos, menos no último. */}
            <div className="flex flex-col items-center pt-1">
              <span className="h-2 w-2 rounded-full bg-piquet shrink-0" />
              {i < eventos.length - 1 && <span className="w-px flex-1 bg-surface-border mt-1" />}
            </div>
            <div className="pb-1">
              <p className="text-sm text-text-primary leading-tight">{e.titulo}</p>
              {e.detalhe && <p className="text-xs text-text-secondary mt-0.5">{e.detalhe}</p>}
              <p className="text-xs text-text-muted mt-0.5">{formatDateTime(e.em)}</p>
            </div>
          </li>
        ))}
      </ol>
      {!completo && (
        <p className="text-xs text-text-muted mt-2">
          Só se sabe quando o pedido entrou. Os passos seguintes ficam registados nos pedidos feitos pela app.
        </p>
      )}
    </div>
  );
}
