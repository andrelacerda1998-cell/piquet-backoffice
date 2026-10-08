import { apiGet } from "./api";

/**
 * Quem bloqueou cada cliente (ou suspendeu cada técnico), quando e porquê:
 * o último registo de cada um em `acoes_da_equipa`. Vazio se a tabela não existir.
 */
export interface MotivoRegistado {
  entidade_id: string;
  staff_email: string | null;
  criado_em: string;
  motivo: string | null;
}

export async function getMotivos(acao: "bloquear_cliente" | "suspender_tecnico"): Promise<Map<string, MotivoRegistado>> {
  const r = await apiGet<{ ativo: boolean; registos: MotivoRegistado[] }>("/acoes-da-equipa", () => ({ ativo: false, registos: [] }), { acao });
  return new Map(r.data.registos.map((m) => [m.entidade_id, m]));
}

export interface EntradaDoHistorico {
  id: string;
  criado_em: string;
  staff_email: string | null;
  acao: string;
  entidade: string;
  entidade_id: string;
  motivo: string | null;
  detalhe: Record<string, unknown> | null;
}

/** O histórico da equipa de um registo (pedido, cliente, técnico…). `ativo: false` sem a tabela. */
export async function getHistorico(entidade: string, id: string): Promise<{ ativo: boolean; registos: EntradaDoHistorico[] }> {
  return apiGet<{ ativo: boolean; registos: EntradaDoHistorico[] }>(
    "/acoes-da-equipa", () => ({ ativo: false, registos: [] }), { entidade, id },
  ).then((r) => r.data);
}

/** As últimas ações de toda a equipa. */
export async function getUltimasAcoes(): Promise<{ ativo: boolean; registos: EntradaDoHistorico[] }> {
  return apiGet<{ ativo: boolean; registos: EntradaDoHistorico[] }>(
    "/acoes-da-equipa", () => ({ ativo: false, registos: [] }),
  ).then((r) => r.data);
}
