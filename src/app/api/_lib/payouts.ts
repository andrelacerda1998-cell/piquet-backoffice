import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Pagamentos a técnicos derivados dos SERVIÇOS concluídos: soma do
 * technician_value por técnico × mês (completed_at; fallback created_at).
 * O estado "processado" vem da tabela technician_payout_records.
 */

interface ServiceRow {
  technician_id: string | null;
  technician_name: string | null;
  technician_value: number | string;
  completed_at: string | null;
  created_at: string;
}

export interface DerivedPayout {
  id: string; // "po|<period>|<techKey>"
  technicianKey: string;
  technicianName: string;
  period: string; // "YYYY-MM"
  services: number;
  amountDue: number;
}

export function techKeyOf(id: string | null, name: string | null): string {
  return id ?? `nome:${(name ?? "").trim().toLowerCase()}`;
}

export function payoutId(period: string, techKey: string): string {
  return `po|${period}|${techKey}`;
}

/** Agrupa os serviços concluídos em payouts por técnico × mês. */
export async function deriveTechnicianPayouts(): Promise<DerivedPayout[]> {
  const { data, error } = await supabaseAdmin()
    .from("services")
    .select("technician_id, technician_name, technician_value, completed_at, created_at")
    .eq("status", "concluido");
  if (error) throw new Error(error.message);

  const groups = new Map<string, DerivedPayout>();
  for (const r of (data ?? []) as ServiceRow[]) {
    const name = r.technician_name?.trim();
    if (!name) continue; // serviço sem técnico não gera pagamento
    const value = Number(r.technician_value) || 0;
    if (value <= 0) continue;
    const period = (r.completed_at ?? r.created_at).slice(0, 7);
    const key = techKeyOf(r.technician_id, name);
    const id = payoutId(period, key);
    const g = groups.get(id) ?? { id, technicianKey: key, technicianName: name, period, services: 0, amountDue: 0 };
    g.services += 1;
    g.amountDue += value;
    groups.set(id, g);
  }
  return [...groups.values()].sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : b.amountDue - a.amountDue));
}
