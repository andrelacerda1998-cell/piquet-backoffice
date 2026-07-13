import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";
import { toMeeting, type MeetingRow } from "../../_lib/team";

/** GET /api/team/agenda — todos os eventos/reuniões da equipa. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("team_meetings")
    .select("*")
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return apiOk((data ?? []).map((r) => toMeeting(r as MeetingRow)));
});
