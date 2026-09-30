import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { avisar, PUSH_CONFIGURADO } from "@/lib/push";

/**
 * POST /api/push/test — manda um aviso só a quem pediu.
 *
 * Existe porque uma notificação que não se consegue experimentar só se
 * descobre partida no dia em que era precisa. Vai apenas aos dispositivos do
 * próprio, nunca aos dos outros.
 */
export const POST = withStaff(async (_req, { staff }) => {
  if (!PUSH_CONFIGURADO) {
    return apiErr("As notificações precisam das chaves VAPID na Vercel.", 503);
  }

  const r = await avisar(
    {
      titulo: "Piquet — teste",
      corpo: "Se estás a ler isto no telemóvel, as notificações funcionam.",
      url: "/",
      tag: "teste",
    },
    staff.userId,
  );

  if (r.enviados === 0 && r.erros.length > 0) return apiErr(r.erros[0], 502);
  return apiOk(r);
});
