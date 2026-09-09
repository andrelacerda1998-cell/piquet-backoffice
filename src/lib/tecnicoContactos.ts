import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { fone9 } from "@/lib/telefone";

/**
 * Saber, do lado de cá, que números de telefone são de técnicos.
 *
 * Os técnicos vivem no Laravel. Mas quem precisa desta resposta é o webhook do
 * WhatsApp, a cada mensagem que entra: sem ela, a mensagem de um técnico vira
 * uma lead e a rede de quem executa os serviços entra na lista de quem os pede.
 *
 * Ir ao Laravel a cada mensagem seria pôr um serviço externo no caminho de
 * todas as mensagens, incluindo quando ele está em baixo -- e uma falha
 * escreveria a resposta errada, não nenhuma. Por isso a lista é copiada para
 * `technician_phones` e lida daí.
 */

interface VendorMinimo { id: number; name: string | null; phone_number: string | null }

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

/**
 * Guarda uma lista de técnicos já lida.
 *
 * Existe separada da função acima para o despacho poder reaproveitar a lista
 * que acabou de ler -- despachar um pedido é o momento em que a lista está
 * mais fresca, e seria absurdo ir buscá-la outra vez a seguir.
 */
export async function guardarTelefonesTecnicos(
  vendors: VendorMinimo[],
): Promise<{ guardados: number; semTelefone: number }> {
  const linhas = vendors
    .map((v) => ({
      phone9: fone9(v.phone_number || ""),
      technician_id: String(v.id),
      name: v.name || "",
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

/**
 * O técnico deste número, ou null se for um cliente.
 *
 * Falhar aqui devolve null -- por omissão trata-se como cliente, que é o que
 * acontecia antes desta separação existir. É a falha certa: uma mensagem a
 * mais no CRM corrige-se, uma mensagem de cliente que não entra no CRM
 * perde-se.
 */
export async function tecnicoPorTelefone(
  phone: string,
): Promise<{ id: string; nome: string } | null> {
  const p9 = fone9(phone);
  if (p9.length !== 9) return null;
  try {
    const { data } = await supabaseAdmin()
      .from("technician_phones")
      .select("technician_id, name")
      .eq("phone9", p9)
      .maybeSingle();
    if (!data) return null;
    const r = data as { technician_id: string; name: string };
    return { id: r.technician_id, nome: r.name };
  } catch {
    return null;
  }
}
