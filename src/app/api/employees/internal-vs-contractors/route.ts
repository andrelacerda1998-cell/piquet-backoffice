import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

/** GET /api/employees/internal-vs-contractors — internos vs prestadores de serviços. */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("employees").select("contract_type");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { contract_type: string }[];
  const contractors = rows.filter((r) => r.contract_type === "prestacao_servicos").length;
  return apiOk([
    { name: "Internos", value: rows.length - contractors },
    { name: "Prestadores", value: contractors },
  ]);
});
