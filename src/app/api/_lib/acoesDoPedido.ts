import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { motivoValido } from "@/lib/motivo";
import { apiOk, apiErr, type StaffContext } from "./handler";
import { anularRegisto, registarAcao, type AcaoDaEquipa } from "./acoesDaEquipa";

/**
 * As ações sobre um pedido que vivem no Laravel (backend #165): despachar um
 * personalizado, fechar, tentar cobrar, desistir e devolver. Cada rota do
 * backoffice é uma porta para a mesma operação do Filament.
 *
 * As que mexem em dinheiro do cliente (fechar = cobrar; desistir = devolver)
 * pedem motivo, gravado com o autor ANTES da ação e retirado se ela falhar.
 */
export type AcaoDoPedido = "despachar" | "fechar" | "tentar-cobrar" | "desistir-e-devolver";

const COM_MOTIVO: Partial<Record<AcaoDoPedido, AcaoDaEquipa>> = {
  fechar: "fechar_pedido",
  "desistir-e-devolver": "desistir_e_devolver",
};

export interface ResultadoDaAcao { id: string; status: string; payment_status: string; convidados?: number }

export async function correrAcaoDoPedido(
  acao: AcaoDoPedido,
  id: string,
  staff: StaffContext,
  corpo: Record<string, unknown>,
): Promise<Response> {
  if (!LARAVEL_ADMIN_ENABLED) return apiErr("API de admin do Laravel não configurada.", 503);
  if (!/^\d+$/.test(id)) return apiErr("Pedido não encontrado.", 404);

  let registoId: string | null = null;
  const comMotivo = COM_MOTIVO[acao];
  if (comMotivo) {
    const motivo = motivoValido(corpo.motivo);
    if (!motivo) return apiErr("Escreve o motivo (pelo menos 5 letras). Fica registado com o teu nome.", 422);
    const r = await registarAcao(staff, comMotivo, "pedido", id, motivo);
    if (!r.ok) return apiErr(r.erro, r.status);
    registoId = r.id;
  }

  const body = acao === "despachar" ? { minutos: corpo.minutos, areas: corpo.areas } : {};
  try {
    const data = await laravelAdminRequest<ResultadoDaAcao>(`/v1/admin/services/${id}/${acao}`, { method: "POST", body });
    return apiOk(data);
  } catch (e) {
    if (registoId) await anularRegisto(registoId);
    if (e instanceof ApiError && e.status === 404) {
      return apiErr("Esta ação ainda não existe no Laravel (falta o deploy do backend #165).", 503);
    }
    return apiErr(e instanceof ApiError ? e.message : "Erro ao falar com o Laravel.", e instanceof ApiError ? e.status : 500);
  }
}
