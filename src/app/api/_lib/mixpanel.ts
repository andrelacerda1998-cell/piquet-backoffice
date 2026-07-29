/**
 * Integração Mixpanel — funil da jornada na app (onde os utilizadores param).
 *
 * Usa a Query API com um Service Account (Basic auth). O funil é definido no
 * Mixpanel (relatório guardado) e referenciado por `MIXPANEL_FUNNEL_ID`; se não
 * for definido, usa o primeiro funil guardado do projeto.
 *
 * Env vars (na Vercel):
 *   MIXPANEL_SA_USERNAME   — utilizador do Service Account
 *   MIXPANEL_SA_SECRET     — segredo do Service Account
 *   MIXPANEL_PROJECT_ID    — id do projeto
 *   MIXPANEL_FUNNEL_ID     — (opcional) id do funil guardado
 *   MIXPANEL_API_HOST      — (opcional) https://mixpanel.com (default) ou
 *                            https://eu.mixpanel.com para projetos na UE
 */

// Trim defensivo: colar credenciais na Vercel arrasta muitas vezes um espaço/
// newline no fim, que parte a autenticação Basic do Mixpanel.
const env = (k: string) => (process.env[k] ?? "").trim();
const HOST = env("MIXPANEL_API_HOST") || "https://mixpanel.com";

export function mixpanelConfigured(): boolean {
  return !!(env("MIXPANEL_SA_USERNAME") && env("MIXPANEL_SA_SECRET") && env("MIXPANEL_PROJECT_ID"));
}

function authHeader(): string {
  return "Basic " + Buffer.from(`${env("MIXPANEL_SA_USERNAME")}:${env("MIXPANEL_SA_SECRET")}`).toString("base64");
}

async function query(path: string, params: Record<string, string | number | undefined>): Promise<unknown> {
  const url = new URL(`${HOST}/api/query/${path}`);
  url.searchParams.set("project_id", env("MIXPANEL_PROJECT_ID"));
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader(), Accept: "application/json" } });
  if (!res.ok) throw new Error(`Mixpanel ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

export interface FunnelStep {
  event: string;
  count: number;
  stepConvRatio: number;    // conversão face ao passo anterior (0–1)
  overallConvRatio: number; // conversão face ao 1.º passo (0–1)
  dropOff: number;          // % que caiu do passo anterior (0–1)
}
export interface FunnelResult {
  configured: boolean;
  funnelId: string | null;
  name: string | null;
  from: string;
  to: string;
  steps: FunnelStep[];
  error?: string;
}

async function resolveFunnel(): Promise<{ id: string; name: string | null }> {
  const envId = process.env.MIXPANEL_FUNNEL_ID;
  const list = (await query("funnels/list", {})) as { funnel_id: number | string; name: string }[];
  const arr = Array.isArray(list) ? list : [];
  if (envId) {
    const match = arr.find((f) => String(f.funnel_id) === String(envId));
    return { id: envId, name: match?.name ?? null };
  }
  if (!arr.length) throw new Error("Sem funis guardados no Mixpanel. Cria um funil (relatório) ou define MIXPANEL_FUNNEL_ID.");
  return { id: String(arr[0].funnel_id), name: arr[0].name ?? null };
}

interface RawStep { event?: string; step_label?: string; count?: number }

/** Puxa o funil e agrega os passos ao longo do período (soma contagens). */
export async function fetchAppFunnel(fromDate: string, toDate: string): Promise<FunnelResult> {
  const { id, name } = await resolveFunnel();
  // unit=month: conta utilizadores ÚNICOS por mês (deduplicado). Somar por dia
  // contaria a dobrar quem entra no funil em vários dias — daí usar-se o mês.
  const data = (await query("funnels", { funnel_id: id, from_date: fromDate, to_date: toDate, unit: "month" })) as {
    data?: Record<string, { steps?: RawStep[] }>;
  };

  // Resposta por mês: { "YYYY-MM-01": { steps: [...] } }. Para um intervalo de
  // um mês há um só balde; se houver mais, somam-se os passos por índice.
  const byDate = data.data ?? {};
  const sums: number[] = [];
  const labels: string[] = [];
  for (const day of Object.values(byDate)) {
    (day.steps ?? []).forEach((s, i) => {
      sums[i] = (sums[i] ?? 0) + (Number(s.count) || 0);
      if (!labels[i]) labels[i] = s.step_label || s.event || `Passo ${i + 1}`;
    });
  }

  const first = sums[0] || 0;
  const steps: FunnelStep[] = sums.map((count, i) => {
    const prev = i === 0 ? count : sums[i - 1] || 0;
    return {
      event: labels[i] ?? `Passo ${i + 1}`,
      count,
      stepConvRatio: i === 0 ? 1 : prev > 0 ? count / prev : 0,
      overallConvRatio: first > 0 ? count / first : 0,
      dropOff: i === 0 ? 0 : prev > 0 ? 1 - count / prev : 0,
    };
  });

  return { configured: true, funnelId: id, name, from: fromDate, to: toDate, steps };
}

