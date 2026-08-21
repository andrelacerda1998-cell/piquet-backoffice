import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../_lib/handler";

/**
 * DELETE /api/support/inbox/:id — apaga um ticket de vez.
 *
 * Existe sobretudo para limpar os tickets de exemplo, mas serve para qualquer
 * um (spam, duplicado, teste). É irreversível: apaga a conversa toda, por isso
 * a interface pede confirmação a dizer isso mesmo.
 */
export const DELETE = withStaff(async (_req, { params }) => {
  const { error } = await supabaseAdmin().from("support_tickets").delete().eq("id", params.id);
  if (error) return apiErr(error.message, 400);
  return apiOk({ id: params.id });
});
