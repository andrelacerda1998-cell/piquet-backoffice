import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

interface Row {
  status: string;
  service_count: number;
  complaint_count: number;
  piquet_revenue: number;
  average_rating: number;
  registered_at: string;
}

/** GET /api/customers/metrics — mesma lógica do mock, sobre a vista enriched. */
export const GET = withStaff(async () => {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("customers_enriched")
    .select("status, service_count, complaint_count, piquet_revenue, average_rating, registered_at");
  if (error) throw new Error(error.message);
  const customers = (data ?? []) as Row[];

  const recurring = customers.filter((c) => c.status === "recorrente" || c.service_count >= 3);
  const active = customers.filter((c) => c.status === "ativo" || c.status === "recorrente");
  const oneTime = customers.filter((c) => c.service_count === 1);
  const inactive = customers.filter((c) => c.status === "inativo");
  const withComplaints = customers.filter((c) => c.complaint_count > 0);
  const totalRevenue = customers.reduce((s, c) => s + Number(c.piquet_revenue), 0);
  const rated = customers.filter((c) => c.average_rating > 0);
  const n = customers.length;

  return apiOk({
    registered: n,
    newCustomers: customers.filter((c) => (Date.now() - new Date(c.registered_at).getTime()) / 86400000 <= 30).length,
    active: active.length,
    recurring: recurring.length,
    oneTime: oneTime.length,
    inactive: inactive.length,
    repurchaseRate: n ? (recurring.length / n) * 100 : 0,
    avgServicesPerCustomer: n ? customers.reduce((s, c) => s + c.service_count, 0) / n : 0,
    avgRevenuePerCustomer: n ? totalRevenue / n : 0,
    estimatedLTV: n ? (totalRevenue / n) * 2.5 : 0,
    avgTimeToSecondService: 45,
    averageRating: rated.length ? rated.reduce((s, c) => s + Number(c.average_rating), 0) / rated.length : 0,
    withComplaints: withComplaints.length,
  });
});
