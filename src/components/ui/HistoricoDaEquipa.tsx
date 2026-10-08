"use client";

import { useAsyncData } from "@/hooks/useDashboard";
import { getHistorico, type EntradaDoHistorico } from "@/services/acoesDaEquipaService";
import { rotuloDaAcao } from "@/lib/registoDaEquipa";
import { formatDateTime } from "@/lib/formatters";

/**
 * O que a equipa fez a um registo (pedido, cliente, técnico): quem, quando,
 * o quê e, quando houve, o motivo. Vem de `acoes_da_equipa`, que o backoffice
 * escreve a cada alteração desde 08/10/2026.
 */
export function HistoricoDaEquipa({ entidade, id }: { entidade: string; id: string }) {
  const { data, loading, error } = useAsyncData(() => getHistorico(entidade, id), [entidade, id]);

  if (loading && !data) return <p className="text-sm text-text-muted">A carregar…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data?.ativo) return <p className="text-sm text-text-muted">O histórico da equipa ainda não está ligado.</p>;
  if (data.registos.length === 0) {
    return <p className="text-sm text-text-muted">Ninguém da equipa mexeu aqui (o registo existe desde 08/10/2026).</p>;
  }
  return <ListaDoHistorico registos={data.registos} />;
}

export function ListaDoHistorico({ registos, comRegisto = false }: { registos: EntradaDoHistorico[]; comRegisto?: boolean }) {
  return (
    <ul className="divide-y divide-surface-border">
      {registos.map((r) => (
        <li key={r.id} className="py-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-medium text-text-primary">
              {rotuloDaAcao(r.acao)}
              {comRegisto && r.entidade_id && <span className="font-normal text-text-secondary"> · {r.entidade} {r.entidade_id}</span>}
            </span>
            <span className="text-xs text-text-muted tabular-nums">{formatDateTime(r.criado_em)}</span>
          </div>
          <p className="text-xs text-text-secondary">
            {r.staff_email ?? "Sem autor"}
            {r.motivo && <> · «{r.motivo}»</>}
          </p>
        </li>
      ))}
    </ul>
  );
}
