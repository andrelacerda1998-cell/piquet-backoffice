import { withStaff } from "../../../_lib/handler";
import { lerNotas, acrescentarNota } from "../../../_lib/notas";

/** GET/POST /api/customers/:id/notas — as notas internas da equipa sobre este cliente. */
export const GET = withStaff(lerNotas("cliente"));
export const POST = withStaff(acrescentarNota("cliente"));
