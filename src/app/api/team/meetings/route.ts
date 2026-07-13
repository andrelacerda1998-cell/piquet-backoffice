import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { toMeeting, type MeetingRow } from "../../_lib/team";

/** POST /api/team/meetings — marca uma reunião na agenda de um colaborador. */
export const POST = withStaff(async (req, { staff }) => {
  const b = (await req.json()) as {
    person?: string; date?: string; start?: string; end?: string; title?: string;
    type?: string; participants?: string[]; location?: string;
  };
  if (!b.person || !b.title?.trim() || !b.date || !b.start || !b.end) {
    return apiErr("Campos obrigatórios em falta (person, title, date, start, end).", 400);
  }
  const id = `mtg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabaseAdmin()
    .from("team_meetings")
    .insert({
      id, person: b.person, date: b.date, start_time: b.start, end_time: b.end, title: b.title.trim(),
      type: b.type ?? "reuniao", participants: b.participants ?? [], location: b.location ?? null, created_by: staff.userId,
    })
    .select("*")
    .single();
  if (error) return apiErr(error.message, 400);
  return apiOk(toMeeting(data as MeetingRow));
});
