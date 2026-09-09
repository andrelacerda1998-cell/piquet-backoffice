"use client";

import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatters";
import { LEAD_STAGE_IDS, type LeadStageId } from "@/lib/leadStages";

/**
 * Onde o pedido está, e onde parou.
 *
 * Um estado diz em que ponto está; não diz há quanto tempo lá está nem o que
 * já aconteceu antes. Era o que faltava para se perceber por que razão um
 * pedido não avançou -- a pergunta que se faz sempre que alguém liga a
 * reclamar.
 *
 * Os passos são os estados do pedido, não uma lista à parte: uma segunda lista
 * divergiria da primeira no dia em que alguém acrescentasse um estado.
 */

interface Passo {
  id: LeadStageId;
  rotulo: string;
  /** O que se sabe sobre este passo, quando se sabe. */
  detalhe?: string;
}

const ROTULOS: Record<LeadStageId, string> = {
  novo: "Pedido recebido",
  a_procurar: "À procura de técnico",
  com_tecnico: "Técnico atribuído",
  agendado: "Serviço agendado",
  em_execucao: "Em execução",
  concluido: "Concluído",
  perdido: "Perdido",
};

/** A ordem por que um pedido passa. "Perdido" não é um passo: é uma saída. */
const PERCURSO = LEAD_STAGE_IDS.filter((s) => s !== "perdido");

export function CronologiaPedido({ estado, recebidoEm, marcadoPara, tecnico, difusoes }: {
  estado: LeadStageId;
  recebidoEm?: string;
  marcadoPara?: string | null;
  tecnico?: string | null;
  /** Quantos técnicos foram perguntados e quantos aceitaram, quando se sabe. */
  difusoes?: { perguntados: number; aceites: number };
}) {
  if (estado === "perdido") {
    return (
      <p className="text-sm text-text-secondary">
        Pedido perdido. O percurso parou onde estava.
      </p>
    );
  }

  const atual = PERCURSO.indexOf(estado);
  const passos: Passo[] = PERCURSO.map((id) => {
    const p: Passo = { id, rotulo: ROTULOS[id] };
    if (id === "novo" && recebidoEm) p.detalhe = formatDateTime(recebidoEm);
    if (id === "a_procurar" && difusoes && difusoes.perguntados > 0) {
      p.detalhe = `${difusoes.perguntados} perguntados · ${difusoes.aceites} aceitaram`;
    }
    if (id === "com_tecnico" && tecnico) p.detalhe = tecnico;
    if (id === "agendado" && marcadoPara) p.detalhe = formatDateTime(marcadoPara);
    return p;
  });

  return (
    <ol className="list-none m-0 p-0">
      {passos.map((p, i) => {
        const feito = i < atual;
        const agora = i === atual;
        return (
          <li key={p.id} className="flex gap-3 relative pb-3 last:pb-0">
            {/* A linha que liga os pontos pára no último. */}
            {i < passos.length - 1 && (
              <span className="absolute left-[6px] top-4 bottom-0 w-px bg-surface-border" aria-hidden />
            )}
            <span className={cn(
              "mt-1 h-3.5 w-3.5 rounded-full shrink-0 border-2",
              feito && "bg-success border-success",
              agora && "bg-piquet border-piquet ring-4 ring-piquet/15",
              !feito && !agora && "bg-surface border-surface-border",
            )} />
            <span className="min-w-0">
              <span className={cn(
                "block text-sm leading-tight",
                agora && "font-semibold text-text-primary",
                feito && "text-text-primary",
                !feito && !agora && "text-text-muted",
              )}>
                {p.rotulo}
              </span>
              {p.detalhe && (
                <span className="block text-[11px] text-text-muted tabular-nums mt-0.5">{p.detalhe}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
