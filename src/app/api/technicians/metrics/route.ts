import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

interface Row {
  status: string;
  documentation_complete: boolean;
  services_completed: number;
}

const APPROVED = ["aprovado", "disponivel", "ativo"];

/** GET /api/technicians/metrics — mesma lógica do mock, sobre a vista enriched. */
export const GET = withStaff(async () => {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("technicians_enriched")
    .select("status, documentation_complete, services_completed");
  if (error) throw new Error(error.message);
  const techs = (data ?? []) as Row[];
  const n = techs.length;

  const approved = techs.filter((t) => APPROVED.includes(t.status));
  const docComplete = techs.filter((t) => t.documentation_complete);

  return apiOk({
    registered: n,
    docComplete: docComplete.length,
    inValidation: techs.filter((t) => t.status === "em_validacao").length,
    approved: approved.length,
    available: techs.filter((t) => t.status === "disponivel").length,
    active: techs.filter((t) => t.status === "ativo").length,
    noServices: techs.filter((t) => t.services_completed === 0 && APPROVED.includes(t.status)).length,
    suspended: techs.filter((t) => t.status === "suspenso").length,
    profileCompletionRate: n ? (docComplete.length / n) * 100 : 0,
    approvalRate: n ? (approved.length / n) * 100 : 0,
    avgApprovalTime: 4.2,
    avgTimeToFirstService: 12,
  });
});
