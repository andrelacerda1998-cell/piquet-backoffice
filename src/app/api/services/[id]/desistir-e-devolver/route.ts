import { withStaff } from "../../../_lib/handler";
import { correrAcaoDoPedido } from "../../../_lib/acoesDoPedido";

/** POST /api/services/:id/desistir-e-devolver — ver src/app/api/_lib/acoesDoPedido.ts. */
export const POST = withStaff(async (req, { params, staff }) =>
  correrAcaoDoPedido("desistir-e-devolver", params.id, staff, ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>));
