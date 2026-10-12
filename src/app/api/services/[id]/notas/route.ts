import { withStaff } from "../../../_lib/handler";
import { lerNotas, acrescentarNota } from "../../../_lib/notas";

/** GET/POST /api/services/:id/notas — as notas internas da equipa sobre este pedido. */
export const GET = withStaff(lerNotas("pedido"));
export const POST = withStaff(acrescentarNota("pedido"));
