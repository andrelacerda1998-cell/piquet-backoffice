import { apiGet, apiPost } from "./api";
import type { NotaInterna, EntidadeDaNota } from "@/app/api/_lib/notas";

export type { NotaInterna, EntidadeDaNota };

/** O caminho da API de cada ficha: o pedido 282 → /services/282. */
const BASE: Record<EntidadeDaNota, string> = { pedido: "/services", cliente: "/customers", tecnico: "/technicians" };

/** As notas internas de um pedido, cliente ou técnico (as mais recentes primeiro). */
export async function getNotas(entidade: EntidadeDaNota, id: string): Promise<NotaInterna[]> {
  return apiGet<NotaInterna[]>(`${BASE[entidade]}/${id}/notas`, () => []).then((r) => r.data ?? []);
}

/** Acrescenta uma nota. Não há editar nem apagar: um engano corrige-se com outra. */
export async function escreverNota(entidade: EntidadeDaNota, id: string, texto: string): Promise<NotaInterna> {
  return apiPost<NotaInterna>(`${BASE[entidade]}/${id}/notas`, { texto }, () => ({
    id: `demo_${Date.now()}`, criadoEm: new Date().toISOString(), autor: "Tu (demonstração)", texto,
  })).then((r) => r.data);
}
