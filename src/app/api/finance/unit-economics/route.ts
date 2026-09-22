import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";
import { servicosConcluidos } from "../../_lib/finance";

/**
 * GET /api/finance/unit-economics — LTV, CAC e serviços/cliente das fontes REAIS.
 *
 * Como a tabela de clientes ainda está vazia (backend de reservas por ligar),
 * os clientes são contados a partir dos SERVIÇOS concluídos registados: cada
 * `customer_name` distinto é um cliente (um serviço sem nome conta como cliente
 * próprio). Assim:
 *   - CAC = investimento em anúncios (mês) ÷ clientes novos (mês)
 *   - Serviços/cliente = serviços (mês) ÷ clientes novos (mês)
 *   - LTV = comissão média da Piquet por cliente (todo o histórico)
 *
 * O investimento vem do Meta (real). "Clientes novos" = clientes servidos no
 * mês (aproximação até haver histórico de registo por cliente).
 */

import type { ServicoConcluido } from "../../_lib/finance";

/** Identidade do cliente: o nome, ou o id do serviço se for anónimo. */
const identity = (r: ServicoConcluido) => (r.customer_name?.trim() || r.id);

export const GET = withStaff(async () => {
  const admin = supabaseAdmin();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [services, adRes] = await Promise.all([
    servicosConcluidos({ period: null }),
    admin.from("ad_metrics").select("spend").gte("date", monthStart.slice(0, 10)),
  ]);
  const adSpendMonth = (adRes.data ?? []).reduce((s, r) => s + (Number((r as { spend: number }).spend) || 0), 0);

  // Todo o histórico → LTV (comissão média por cliente).
  const allCustomers = new Set(services.map(identity));
  const totalRevenue = services.reduce((s, r) => s + (Number(r.piquet_revenue) || 0), 0);
  const totalCustomers = allCustomers.size;

  // Este mês → CAC e serviços/cliente.
  const monthSvc = services.filter((r) => (r.completed_at ?? "") >= monthStart);
  const newCustomers = new Set(monthSvc.map(identity)).size;
  const servicesMonth = monthSvc.length;

  return apiOk({
    ltv: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
    cac: newCustomers > 0 ? adSpendMonth / newCustomers : 0,
    servicesPerCustomer: newCustomers > 0 ? servicesMonth / newCustomers : 0,
    adSpendMonth,
    newCustomersMonth: newCustomers,
    servicesMonth,
    totalCustomers,
  });
});
