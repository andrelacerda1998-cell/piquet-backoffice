import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { fone9 } from "@/lib/telefone";

/**
 * Uma cópia local de quem são os técnicos: nome, telefone e ofício.
 *
 * Os técnicos vivem no Laravel, e o token para lá chegar só existe no
 * servidor. Esta cópia é o que permite responder a perguntas sobre a rede sem
 * uma chamada externa no caminho -- por exemplo "quem faz canalização", para
 * falar com um grupo de técnicos de uma vez.
 *
 * Nasceu para o webhook do WhatsApp distinguir técnicos de clientes. Esse
 * webhook saiu com a Cloud API (18/09/2026); o que ficou foi a cópia, que é
 * útil por si.
 */

interface VendorMinimo {
  id: number;
  name: string | null;
  phone_number: string | null;
  /*
    No Laravel chamam-se `operation_areas`, mas são CATEGORIAS de serviço
    ("Canalização", "Eletricidade"), não zonas geográficas. O nome engana e já
    levou a ordenar técnicos por cidade contra este campo -- uma ordenação que
    não fazia nada.
  */
  operation_areas?: string[] | null;
}

/**
 * Actualiza a cópia local a partir do Laravel. Devolve quantos números ficaram
 * conhecidos, ou lança quando o Laravel não responde.
 *
 * Idempotente: é um upsert por número, pode correr as vezes que forem precisas.
 */
export async function sincronizarTelefonesTecnicos(): Promise<{ guardados: number; semTelefone: number }> {
  const r = await laravelAdminRequest<{ items: VendorMinimo[] }>("/v1/admin/vendors?per_page=1000");
  return guardarTelefonesTecnicos(r.items ?? []);
}

/** Guarda uma lista de técnicos já lida. */
export async function guardarTelefonesTecnicos(
  vendors: VendorMinimo[],
): Promise<{ guardados: number; semTelefone: number }> {
  const linhas = vendors
    .map((v) => ({
      phone9: fone9(v.phone_number || ""),
      technician_id: String(v.id),
      name: v.name || "",
      trades: (v.operation_areas ?? []).filter((t): t is string => Boolean(t && t.trim())),
      updated_at: new Date().toISOString(),
    }))
    .filter((l) => l.phone9.length === 9);

  if (linhas.length === 0) {
    return { guardados: 0, semTelefone: vendors.length };
  }

  const { error } = await supabaseAdmin()
    .from("technician_phones")
    .upsert(linhas, { onConflict: "phone9" });
  if (error) throw new Error(error.message);

  return { guardados: linhas.length, semTelefone: vendors.length - linhas.length };
}
