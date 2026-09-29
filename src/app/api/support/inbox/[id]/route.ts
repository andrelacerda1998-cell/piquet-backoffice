import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { ehTicketDeTecnico } from "@/lib/ticketsTecnicos";

/**
 * DELETE /api/support/inbox/:id — apaga um ticket de vez.
 *
 * Existe sobretudo para limpar os tickets de exemplo, mas serve para qualquer
 * um (spam, duplicado, teste). É irreversível: apaga a conversa toda, por isso
 * a interface pede confirmação a dizer isso mesmo.
 */
export const DELETE = withStaff(async (_req, { params }) => {
  /*
    Um ticket de técnico vive no Laravel e é o registo de uma pessoa que
    pediu ajuda -- em particular, pode ser a contestação de uma falta que lhe
    custou dinheiro. Apagar isso daqui, sem rasto, não é limpeza.
  */
  if (ehTicketDeTecnico(params.id)) {
    return apiErr("Os tickets dos técnicos não se apagam pelo backoffice.", 400);
  }

  const { error } = await supabaseAdmin().from("support_tickets").delete().eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});
