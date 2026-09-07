import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";

/**
 * POST /api/marketing/attribution/match — casa leads com clientes do Laravel.
 *
 * É o elo que faltava para o ROAS real: as leads estão no Supabase, os
 * clientes no Laravel e o dinheiro no Payshop. O telefone é o único campo
 * comum, e só o servidor consegue falar com os três.
 *
 * Corre sobre TODAS as leads por casar (não só as novas): um cliente pode
 * registar-se semanas depois de deixar a lead, e nessa altura a lead antiga
 * passa a ter correspondência.
 */

interface ClienteLaravel {
  id: number;
  phone_number: string | null;
}

/** Últimos 9 dígitos — mesma regra do `fone9` em SQL. */
const fone9 = (t: string | null | undefined): string =>
  (t ?? "").replace(/\D/g, "").slice(-9);

export const POST = withStaff(async () => {
  if (!LARAVEL_ADMIN_ENABLED) {
    return apiErr("Casar leads precisa da API de admin do Laravel configurada.", 503);
  }

  // Todos os clientes, em páginas de 100 (o backend recusa mais).
  const clientes: ClienteLaravel[] = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const r = await laravelAdminRequest<{ items: ClienteLaravel[]; meta: { last_page: number } }>(
      `/v1/admin/customers?page=${pagina}&per_page=100`,
    );
    clientes.push(...(r.items ?? []));
    if (pagina >= (r.meta?.last_page ?? 1)) break;
  }

  /*
    Índice telefone → id. Números repetidos são marcados e depois ignorados:
    com dois clientes no mesmo número não há como saber a quem pertence a
    lead, e atribuir receita ao palpite é pior do que deixar por atribuir.
  */
  const porFone = new Map<string, number | null>();
  for (const c of clientes) {
    const f = fone9(c.phone_number);
    if (f.length < 9) continue;
    porFone.set(f, porFone.has(f) ? null : c.id);
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("leads")
    .select("id, phone")
    .is("laravel_customer_id", null);
  if (error) throw new Error(error.message);

  const leads = (data ?? []) as { id: string; phone: string | null }[];
  let casadas = 0;
  let ambiguas = 0;

  for (const l of leads) {
    const f = fone9(l.phone);
    if (f.length < 9) continue;
    if (!porFone.has(f)) continue;
    const id = porFone.get(f);
    if (id === null) { ambiguas++; continue; }
    const { error: upErr } = await db
      .from("leads")
      .update({ laravel_customer_id: id, matched_at: new Date().toISOString() })
      .eq("id", l.id);
    if (!upErr) casadas++;
  }

  return apiOk({
    clientes: clientes.length,
    leadsPorCasar: leads.length,
    casadas,
    ambiguas,
    semTelefoneUtil: leads.filter((l) => fone9(l.phone).length < 9).length,
  });
});
