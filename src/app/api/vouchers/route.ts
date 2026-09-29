import { apiOk, apiErr, withStaff } from "../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * Vouchers — os REAIS, do Laravel (`/v1/admin/vouchers`).
 *
 * Esta rota existia e nunca tinha sido chamada por ninguém. Entretanto o ecrã
 * de Marketing mostrava uma lista de "códigos de desconto" guardada no
 * localStorage do browser, semeada com quatro códigos que não existem
 * (VERAO25, VOLTEI10, BEMVINDO5, PRIMAVERA) e com 34.852 € de "receita
 * gerada" inventados. Criar um código ali não criava nada: o cliente que o
 * escrevesse na app ouvia que era inválido.
 *
 * Passa a ser esta a fonte, e a devolver a forma que o ecrã usa em vez do
 * envelope paginado do Laravel — com a validação feita aqui, para o erro
 * aparecer no formulário em vez de voltar um 422 de longe, em inglês.
 */

import {
  toVoucher, paraLaravel, queixaDe,
  type VoucherLaravel, type NovoVoucher,
} from "@/lib/vouchers";

export type { Voucher, NovoVoucher, VoucherLaravel } from "@/lib/vouchers";

const SEM_LARAVEL = "A API de admin do Laravel não está configurada — os vouchers vivem lá.";

/** GET /api/vouchers — todos, do mais recente para o mais antigo. */
export const GET = withStaff(async () => {
  if (!LARAVEL_ADMIN_ENABLED) return apiErr(SEM_LARAVEL, 503);
  try {
    // O Laravel pagina e limita a 100 por página. São poucos, mas não se assume:
    // foi exatamente assim que a sincronização de técnicos leu 100 de 438.
    const todos: VoucherLaravel[] = [];
    for (let pagina = 1; pagina <= 20; pagina++) {
      const r = await laravelAdminRequest<{ items: VoucherLaravel[]; meta: { last_page: number } }>(
        `/v1/admin/vouchers?per_page=100&page=${pagina}`,
      );
      todos.push(...(r.items ?? []));
      if (pagina >= (r.meta?.last_page ?? 1)) break;
    }
    return apiOk(todos.map(toVoucher));
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao listar vouchers.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});

/** POST /api/vouchers — cria um voucher que funciona mesmo na app. */
export const POST = withStaff(async (req) => {
  if (!LARAVEL_ADMIN_ENABLED) return apiErr(SEM_LARAVEL, 503);

  const corpo = (await req.json().catch(() => null)) as Partial<NovoVoucher> | null;
  if (!corpo) return apiErr("Corpo do pedido inválido.", 400);

  const queixa = queixaDe(corpo, true);
  if (queixa) return apiErr(queixa, 422);

  try {
    const criado = await laravelAdminRequest<VoucherLaravel>("/v1/admin/vouchers", {
      method: "POST",
      body: paraLaravel(corpo),
    });
    return apiOk(toVoucher(criado), 201);
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao criar o voucher.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
