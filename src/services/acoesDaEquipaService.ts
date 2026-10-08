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
