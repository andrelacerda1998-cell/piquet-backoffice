/**
 * Faturas de serviços fechados que ficaram por emitir (backend#176,
 * `FaturasPorEmitirController`).
 *
 * Desde 13/10/2026 só se paga um serviço depois de a fatura dele sair. A
 * fatura falha quando o técnico ainda não tem conta de faturação ou AT (os
 * três primeiros serviços fazem-se sem elas), e sai mais tarde: sozinha, na
 * tarefa das 06:20, ou com o "Emitir agora".
 */

export type SituacaoDaFatura =
  | "sem_conta_de_faturacao"
  | "sem_at"
  | "fatura_iniciada"
  | "pronta_a_emitir";

export interface FaturaPorEmitir {
  service_id: number;
  vendor_id: number;
  vendor_name: string | null;
  service_type: string | null;
  /** O valor da fatura (o que o cliente pagou), com IVA. */
  amount: number;
  /** A parte do técnico, que fica retida até a fatura sair. */
  amount_for_vendor: number;
  finished_at: string | null;
  dias_em_atraso: number;
  situacao: SituacaoDaFatura;
  invoice_id: number | null;
}

export interface FaturasPorEmitir {
  /** `false` quando o backend ainda não tem a lista (antes do deploy do #176). */
  ativo?: boolean;
  items: FaturaPorEmitir[];
  total: number;
}

/** O que falta a cada fatura, dito para o backoffice, e de quem é a vez. */
export const SITUACAO: Record<SituacaoDaFatura, { texto: string; deQuem: "piquet" | "tecnico" }> = {
  sem_conta_de_faturacao: {
    texto: "Sem conta de faturação: criá-la na ficha do técnico (precisa do IBAN e da morada fiscal)",
    deQuem: "piquet",
  },
  sem_at: { texto: "Falta o subutilizador da AT (o técnico é lembrado uma vez por semana)", deQuem: "tecnico" },
  fatura_iniciada: { texto: "Já há documento no InvoiceXpress: se continuar aqui, ver lá", deQuem: "piquet" },
  pronta_a_emitir: { texto: "Pronta: sai às 06:20, ou já com “Emitir agora”", deQuem: "piquet" },
};

export interface FaturasDoTecnico {
  vendor_id: number;
  vendor_name: string | null;
  itens: FaturaPorEmitir[];
  /** A parte do técnico nestes serviços: o que lhe fica retido por causa deles. */
  paraOTecnico: number;
  maisAtrasada: number;
  /** Tem pelo menos uma que o "Emitir agora" consegue fazer sair. */
  podeEmitir: boolean;
}

/**
 * Agrupadas por técnico (o "Emitir agora" é por técnico), as mais atrasadas
 * primeiro.
 */
export function porTecnico(items: readonly FaturaPorEmitir[]): FaturasDoTecnico[] {
  const grupos = new Map<number, FaturasDoTecnico>();

  for (const i of items) {
    const g = grupos.get(i.vendor_id) ?? {
      vendor_id: i.vendor_id,
      vendor_name: i.vendor_name,
      itens: [],
      paraOTecnico: 0,
      maisAtrasada: 0,
      podeEmitir: false,
    };
    g.itens.push(i);
    g.paraOTecnico = Math.round((g.paraOTecnico + i.amount_for_vendor) * 100) / 100;
    g.maisAtrasada = Math.max(g.maisAtrasada, i.dias_em_atraso);
    g.podeEmitir ||= i.situacao === "pronta_a_emitir" || i.situacao === "fatura_iniciada";
    grupos.set(i.vendor_id, g);
  }

  return [...grupos.values()].sort((a, b) => b.maisAtrasada - a.maisAtrasada || a.vendor_id - b.vendor_id);
}
