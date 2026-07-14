import "server-only";

export interface DevRow {
  id: string;
  section: string;
  status: string;
  title: string;
  description: string | null;
  priority: string;
  assignee: string | null;
  created_by: string | null;
  created_by_name: string | null;
  position: number;
  created_at: string;
}

/** Linha `dev_tasks` → forma que o frontend espera (camelCase). */
export function toDevTask(r: DevRow) {
  return {
    id: r.id,
    section: r.section,
    status: r.status,
    title: r.title,
    description: r.description ?? undefined,
    priority: r.priority,
    assignee: r.assignee ?? undefined,
    createdByName: r.created_by_name ?? undefined,
    position: r.position,
    createdAt: r.created_at,
  };
}
