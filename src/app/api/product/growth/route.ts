import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

/**
 * GET /api/product/growth — evolução mensal de downloads e registos.
 *
 * - downloads: da tabela `app_metrics` (ingerida das lojas pelo cron
 *   /api/cron/app-metrics), somados por mês e acumulados. Enquanto a tabela
 *   estiver vazia (chaves das lojas por configurar), devolve [] e o frontend
 *   usa a série demo.
 * - registrations: contagem REAL de clientes/técnicos por mês de registo.
 */

const MONTHS = 13;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(): Array<{ key: string; label: string }> {
  const fmt = new Intl.DateTimeFormat("pt-PT", { month: "short" });
  const now = new Date();
  return Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1);
    return { key: monthKey(d), label: fmt.format(d).replace(".", "") };
  });
}

export const GET = withStaff(async () => {
  const admin = supabaseAdmin();
  const months = lastMonths();
  const since = `${months[0].key}-01`;

  // ---------- Downloads (app_metrics → soma mensal → acumulado) ----------
  const { data: metricRows, error: mErr } = await admin
    .from("app_metrics")
    .select("date, app, downloads")
    .gte("date", since)
    .order("date", { ascending: true });
  if (mErr) throw new Error(mErr.message);

  const byMonth = new Map<string, { cliente: number; profissional: number }>();
  for (const r of metricRows ?? []) {
    const key = String(r.date).slice(0, 7);
    const m = byMonth.get(key) ?? { cliente: 0, profissional: 0 };
    m[r.app as "cliente" | "profissional"] += r.downloads ?? 0;
    byMonth.set(key, m);
  }

  let cumCliente = 0;
  let cumPro = 0;
  const downloads = (metricRows?.length ? months : []).map(({ key, label }) => {
    const m = byMonth.get(key) ?? { cliente: 0, profissional: 0 };
    cumCliente += m.cliente;
    cumPro += m.profissional;
    return { name: label, Cliente: cumCliente, Profissional: cumPro };
  });

  // ---------- Registos reais por mês (clientes + técnicos) ----------
  const [cust, tech] = await Promise.all([
    admin.from("customers").select("registered_at").gte("registered_at", since),
    admin.from("technicians").select("registered_at").gte("registered_at", since),
  ]);
  if (cust.error) throw new Error(cust.error.message);
  if (tech.error) throw new Error(tech.error.message);

  const countByMonth = (rows: Array<{ registered_at: string }>) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = String(r.registered_at).slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  };
  const custByMonth = countByMonth((cust.data ?? []) as Array<{ registered_at: string }>);
  const techByMonth = countByMonth((tech.data ?? []) as Array<{ registered_at: string }>);

  const registrations = months.map(({ key, label }) => ({
    name: label,
    Clientes: custByMonth.get(key) ?? 0,
    "Técnicos": techByMonth.get(key) ?? 0,
  }));

  return apiOk({ downloads, registrations });
});
