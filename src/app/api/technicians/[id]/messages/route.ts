import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import { apiOk, withStaff } from "../../../_lib/handler";

/**
 * Histórico de WhatsApp de um técnico -- só leitura.
 *
 * Separada da do cliente de propósito: antes, uma mensagem de um técnico só
 * podia existir agarrada a uma lead, e por isso entrava no CRM como se fosse
 * um pedido de serviço. Aqui pertence a quem a escreveu.
 *
 * Enviar daqui deixou de existir com a saída da Cloud API. Fala-se com os
 * técnicos pelo WhatsApp do telemóvel; o ecrã abre a conversa com um `wa.me`.
 */

interface MsgRow {
  id: string; direction: "in" | "out"; body: string;
  status: string; error: string; sent_by: string; created_at: string;
}

function toDTO(r: MsgRow) {
  return {
    id: r.id, direction: r.direction, body: r.body,
    status: r.status, error: r.error, sentBy: r.sent_by, createdAt: r.created_at,
  };
}


export const GET = withStaff(async (_req, { params }) => {
  const db = supabaseAdmin();

  const { data, error } = await db
    .from("whatsapp_messages").select("*")
    .eq("technician_id", params.id)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTable(error, "whatsapp_messages")) {
      return apiOk({ messages: [], migrated: false });
    }
    throw new Error(error.message);
  }

  const msgs = (data ?? []) as MsgRow[];
  return apiOk({ messages: msgs.map(toDTO), migrated: true });
});
