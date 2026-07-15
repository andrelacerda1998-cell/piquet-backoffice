"use client";

import { FlaskConical } from "lucide-react";
import { isDemoEndpoint } from "@/services/api";

/**
 * Selo "Demo" — marca visualmente os números que ainda são inventados.
 *
 * Porquê: o dashboard mostra dados reais (serviços, pagamentos, downloads,
 * anúncios) lado a lado com mocks de demonstração (GMV, qualidade, suporte...).
 * Sem distinção, quem não acompanhou a construção não tem como saber que o
 * "GMV do mês" é fictício — e decide em cima dele.
 *
 * A fonte de verdade é a MESMA allowlist que encaminha os pedidos para o
 * backend real (`isLiveEndpoint`), logo o selo desaparece sozinho quando um
 * endpoint passa a ser real. Não há uma segunda lista para manter em sincronia.
 */
export function DemoBadge({ endpoint, className = "" }: { endpoint: string; className?: string }) {
  if (!isDemoEndpoint(endpoint)) return null;
  return (
    <span
      title="Dados de demonstração — este número é fictício, não vem do sistema real."
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-400 ${className}`}
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      Demo
    </span>
  );
}
