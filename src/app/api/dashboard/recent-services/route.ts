import { supabaseAdmin } from "@/lib/supabase/server";
import { rowToService, embedName, type ServiceRow } from "@/lib/supabase/adapters";
import { apiOk, withStaff } from "../../_lib/handler";
import { servicesFromLaravel, fetchLaravelServices } from "../../_lib/laravelServices";

const SELECT = "*, customer:customers(name), technician:technicians(name), category:categories(name)";

interface EmbeddedRow extends ServiceRow {
  customer?: { name: string } | null;
  technician?: { name: string } | null;
  category?: { name: string } | null;
}

/** GET /api/dashboard/recent-services?limit=10 */
export const GET = withStaff(async (req) => {
  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 10)));

  /*
    Os últimos pedidos vêm de onde vêm os pedidos.

    A tabela local `services` tem uma linha de 15/07/2026 -- o ecrã de entrada
    mostrava-a como "recente" enquanto Operações já listava os serviços reais
    do Laravel. A mesma pergunta, duas respostas.
  */
  if (servicesFromLaravel()) {
    const r = await fetchLaravelServices({ page: 1, pageSize: limit });
    return apiOk(r.data);
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("services")
    .select(SELECT)
    .order("requested_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as EmbeddedRow[];
  return apiOk(
    rows.map((r) =>
      rowToService({ ...r, customer_name: embedName(r.customer), technician_name: embedName(r.technician), category_name: embedName(r.category) })
    )
  );
});
