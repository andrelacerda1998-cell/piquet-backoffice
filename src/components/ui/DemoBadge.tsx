"use client";

import { FlaskConical } from "lucide-react";
import { isDemoEndpoint } from "@/services/api";

/**
 * Selo "Sem integração" — marca as secções sem fonte de dados real.
 *
 * Política "zero em vez de ficção" (2026-07-16): em produção, estas secções
 * mostram 0 e listas vazias em vez de números inventados. O selo explica o
 * porquê dos zeros: ainda não medimos isto, não "o negócio está a zero".
 *
 * A fonte de verdade é `isDemoEndpoint` (assume demo por defeito; só a
 * allowlist `REAL_DATA` do api.ts conta como real), logo o selo desaparece
 * sozinho quando a integração for ligada. Não há segunda lista para manter.
 */
export function DemoBadge({ endpoint, className = "" }: { endpoint: string; className?: string }) {
  if (!isDemoEndpoint(endpoint)) return null;
  return (
    <span
      title="Sem integração de dados reais — em produção estes valores ficam a zero até a fonte ser ligada."
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-400 ${className}`}
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      Sem integração
    </span>
  );
}
