import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import { fone9 } from "@/lib/telefone";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";

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


/**
 * GET — o histórico de WhatsApp de um pedido.
 *
 * Só leitura. A Cloud API saiu do backoffice quando o 926 866 108 passou para
 * a app WhatsApp Business: responder é coisa de uma pessoa, no telemóvel, e o
 * ecrã abre a conversa com um link `wa.me`. O que ficou aqui é o histórico do
 * tempo em que o backoffice enviava -- apagá-lo seria apagar conversas reais
 * com clientes.
 */
export const GET = withStaff(async (_req, { params }) => {
  const db = supabaseAdmin();
  const { data: lead, error: leadErr } = await db
    .from("leads").select("id, phone").eq("id", params.id).maybeSingle();
  if (leadErr) throw new Error(leadErr.message);
  if (!lead) return apiErr("Pedido não encontrado.", 404);

  // Mensagens ligadas pela lead OU pelo telefone (mensagens antigas do mesmo
  // número que ainda não estavam associadas a esta lead).
  const phone = (lead as { phone: string }).phone || "";
  // Pelos últimos 9 dígitos: o mesmo número aparece com e sem indicativo,
  // conforme tenha entrado pela landing ou pela Meta.
  const p9 = fone9(phone);
  let query = db.from("whatsapp_messages").select("*").order("created_at", { ascending: true });
  query = p9 ? query.or(`lead_id.eq.${params.id},phone9.eq.${p9}`) : query.eq("lead_id", params.id);

  const { data, error } = await query;
  if (error) {
    // Sem a migração, não há conversa — mas o resto do ecrã continua a abrir.
    if (isMissingTable(error, "whatsapp_messages")) {
      return apiOk({ messages: [], migrated: false });
    }
    throw new Error(error.message);
  }

  const msgs = (data ?? []) as MsgRow[];
  return apiOk({ messages: msgs.map(toDTO), migrated: true });
});
