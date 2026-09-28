import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { toVoucher, paraLaravel, queixaDe, type VoucherLaravel, type NovoVoucher } from "@/lib/vouchers";

/**
 * Alterar e apagar um voucher real.
 *
 * O `destroy` do Laravel faz soft delete: o voucher deixa de aparecer e de
 * poder ser usado, mas as reservas que já o usaram continuam intactas — a
 * chave estrangeira em `services` é `nullOnDelete` e o histórico de
 * `voucher_usages` fica. Não é como apagar um técnico.
 */

const SEM_LARAVEL = "A API de admin do Laravel não está configurada — os vouchers vivem lá.";

/** Os ids do Laravel são inteiros; qualquer outra coisa não chega a sair daqui. */
function idValido(params: Record<string, string>): string | null {
  return /^\d+$/.test(params.id ?? "") ? params.id : null;
}

/** PUT /api/vouchers/:id — editar, incluindo ligar e desligar. */
export const PUT = withStaff(async (req, { params }) => {
  if (!LARAVEL_ADMIN_ENABLED) return apiErr(SEM_LARAVEL, 503);
  const id = idValido(params);
  if (!id) return apiErr("Voucher desconhecido.", 400);

  const corpo = (await req.json().catch(() => null)) as Partial<NovoVoucher> | null;
  if (!corpo) return apiErr("Corpo do pedido inválido.", 400);

  const queixa = queixaDe(corpo, false);
  if (queixa) return apiErr(queixa, 422);

  try {
    const atualizado = await laravelAdminRequest<VoucherLaravel>(`/v1/admin/vouchers/${id}`, {
      method: "PUT",
      body: paraLaravel(corpo),
    });
    return apiOk(toVoucher(atualizado));
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao atualizar o voucher.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});

/** DELETE /api/vouchers/:id — soft delete no Laravel. */
export const DELETE = withStaff(async (_req, { params }) => {
  if (!LARAVEL_ADMIN_ENABLED) return apiErr(SEM_LARAVEL, 503);
  const id = idValido(params);
  if (!id) return apiErr("Voucher desconhecido.", 400);

  try {
    await laravelAdminRequest(`/v1/admin/vouchers/${id}`, { method: "DELETE" });
    return apiOk({ id });
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao remover o voucher.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
