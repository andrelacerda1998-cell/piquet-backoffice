import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, withStaff } from "../../_lib/handler";

/**
 * GET /api/marketing/leads — leads reais recebidas do formulário da landing
 * (tabela `leads`, escrita pelo POST público /api/leads). Devolve no formato
 * `Lead` que a página de Marketing já consome.
 */

interface Row {
  id: string; name: string; email: string; phone: string; city: string;
  message: string; source: string; stage: string; created_at: string;
}

export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select("id, name, email, phone, city, message, source, stage, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  return apiOk(
    ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      // Nome pode vir vazio do formulário — cai para o contacto que existir.
      name: r.name || r.email || r.phone,
      source: r.source || "website",
      city: r.city || "—",
      stage: (["novo", "contactado", "qualificado", "convertido", "perdido"].includes(r.stage)
        ? r.stage
        : "novo") as "novo" | "contactado" | "qualificado" | "convertido" | "perdido",
      value: 0, // Sem valor estimado real — 0 em vez de inventado.
      createdAt: r.created_at,
    })),
  );
});
