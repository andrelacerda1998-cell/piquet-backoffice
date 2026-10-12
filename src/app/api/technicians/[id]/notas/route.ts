import { withStaff } from "../../../_lib/handler";
import { lerNotas, acrescentarNota } from "../../../_lib/notas";

/** GET/POST /api/technicians/:id/notas — as notas internas da equipa sobre este tecnico. */
export const GET = withStaff(lerNotas("tecnico"));
export const POST = withStaff(acrescentarNota("tecnico"));
