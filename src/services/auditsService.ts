import { apiGet } from "./api";

/**
 * Atividade — feed real de auditoria (tabela `audits` do Laravel, owen-it/
 * laravel-auditing), em vez do registo fictício anterior. Só leitura, sem
 * equivalente direto no Filament (lá é por registo, via AuditsRelationManager
 * em cada recurso; aqui é um feed global). Filtrado a ações de staff
 * (admin/super-admin) — ver nota em AuditController no backend.
 */

export interface AuditEntry {
  id: number;
  who: string;
  action: string;
  entity: string;
  old_value: string | null;
  new_value: string | null;
  at: string | null;
}

export interface AuditsData {
  items: AuditEntry[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getAudits(): Promise<AuditsData> {
  return apiGet<AuditsData>(
    "/audits",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: 50, total: 0 } }),
    { per_page: 50 }
  ).then((r) => r.data);
}
