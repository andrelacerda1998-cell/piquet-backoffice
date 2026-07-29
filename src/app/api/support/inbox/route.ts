import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";
import { toInboxTicket, type TicketRow } from "./_lib";

/** GET /api/support/inbox — tickets de suporte reais, mais recentes primeiro. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("support_tickets")
    .select("*")
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  return apiOk((data ?? []).map((r) => toInboxTicket(r as TicketRow)));
});
