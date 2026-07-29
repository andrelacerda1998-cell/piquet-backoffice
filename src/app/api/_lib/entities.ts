import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cria (ou reutiliza) o cliente/técnico de um serviço registado à mão, para
 * que apareçam nas abas Clientes e Técnicos e as vistas *_enriched calculem as
 * métricas por FK. O emparelhamento é por NOME (case-insensitive): registar
 * dois serviços para "Paulo Cardoso" liga-os ao mesmo cliente, não duplica.
 */

const rid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/** Devolve o id do cliente com este nome, criando-o se ainda não existir. */
export async function upsertCustomerByName(
  admin: SupabaseClient,
  name: string | null | undefined,
  city: string | null,
): Promise<string | null> {
  const clean = name?.trim();
  if (!clean) return null;
  const { data } = await admin.from("customers").select("id").ilike("name", clean).limit(1);
  if (data && data.length) return (data[0] as { id: string }).id;
  const id = rid("cust");
  const { error } = await admin.from("customers").insert({
    id, name: clean, email: "", city, location: city, status: "ativo", source: "manual",
  });
  if (error) throw new Error(error.message);
  return id;
}

/** Devolve o id do técnico com este nome, criando-o se ainda não existir. */
export async function upsertTechnicianByName(
  admin: SupabaseClient,
  name: string | null | undefined,
  city: string | null,
  categoryId: string | null,
): Promise<string | null> {
  const clean = name?.trim();
  if (!clean) return null;
  const { data } = await admin.from("technicians").select("id").ilike("name", clean).limit(1);
  if (data && data.length) return (data[0] as { id: string }).id;
  const id = rid("tech");
  const { error } = await admin.from("technicians").insert({
    id, name: clean, city, location: city,
    categories: categoryId ? [categoryId] : [],
    status: "ativo", verified: false, documentation_complete: false,
  });
  if (error) throw new Error(error.message);
  return id;
}

/**
 * Sincroniza as categorias do técnico com as categorias DISTINTAS dos serviços
 * que ele executou. Chamar depois de gravar o serviço (registo ou edição): ao
 * editar a categoria de um serviço, o técnico não fica com a categoria antiga
 * "presa" — de outro modo apareceria duplicado na contagem por categoria.
 */
export async function syncTechnicianCategories(
  admin: SupabaseClient,
  technicianId: string | null | undefined,
): Promise<void> {
  if (!technicianId) return;
  const { data } = await admin
    .from("services")
    .select("category_id")
    .eq("technician_id", technicianId)
    .not("category_id", "is", null);
  const cats = Array.from(new Set((data ?? []).map((r) => (r as { category_id: string }).category_id)));
  await admin.from("technicians").update({ categories: cats }).eq("id", technicianId);
}
