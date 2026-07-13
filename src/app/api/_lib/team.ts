import "server-only";

export interface MeetingRow {
  id: string; person: string; date: string; start_time: string; end_time: string;
  title: string; type: string; participants: string[] | null; location: string | null;
}

/** Linha team_meetings → TeamAgendaEvent (forma que o frontend espera). */
export function toMeeting(r: MeetingRow) {
  return {
    id: r.id, person: r.person, date: r.date, start: r.start_time, end: r.end_time,
    title: r.title, type: r.type, participants: r.participants ?? [], location: r.location ?? undefined,
  };
}
