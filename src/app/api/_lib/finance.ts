import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getDateRangeFromPreset } from "@/lib/filters";
import { servicesFromLaravel, fetchAllLaravelServices } from "./laravelServices";
import type { PeriodPreset } from "@/types";

/**
 * Helpers dos endpoints financeiros deriváveis dos `services`.
 * Aplicam os mesmos filtros globais do dashboard (período/categoria/cidade)
 * server-side e devolvem apenas serviços concluídos.
 */

export interface FinanceFilters {
  period: PeriodPreset | null;
  categoryId?: string;
  city?: string;
}

export function parseFinanceFilters(url: URL): FinanceFilters {
  const q = url.searchParams;
  return {
    period: (q.get("period") as PeriodPreset | null) ?? null,
    categoryId: q.get("categoryId")?.trim() || undefined,
    city: q.get("city")?.trim() || undefined,
  };
}

/** Aplica status=concluido + filtros globais a uma query de `services`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function completedQuery(columns: string, f: FinanceFilters): any {
  let query = supabaseAdmin().from("services").select(columns).eq("status", "concluido");
  if (f.categoryId) query = query.eq("category_id", f.categoryId);
  if (f.city) query = query.eq("city", f.city);
  if (f.period && f.period !== "personalizado") {
    const { start, end } = getDateRangeFromPreset(f.period);
    query = query.gte("requested_at", start.toISOString()).lte("requested_at", end.toISOString());
  }
  return query;
}


/**
 * Um serviço concluído, na forma que os endpoints financeiros somam.
 *
 * Nomes de coluna (snake_case) e não os do tipo `ServiceRequest`: é o que os
 * chamadores já escreviam quando liam directamente o Supabase, e mudá-los
 * obrigaria a reescrever contas que estão certas.
 */
export interface ServicoConcluido {
  id: string;
  piquet_revenue: number;
  total_customer_value: number;
  technician_value: number;
  invoice_status: string;
  payment_status: string;
  service_name: string;
  vat_value: number;
  requested_at: string;
  completed_at: string | null;
  customer_id: string;
  customer_name: string;
  category_id: string;
  category_name: string;
  city: string;
  technician_id: string;
  technician_name: string;
}

/**
 * Os serviços concluídos -- do Laravel quando ele manda, do Supabase quando não.
 *
 * Porque existe: o Financeiro somava a tabela LOCAL `services`, que tem uma
 * linha de 15/07/2026, enquanto o ecrã de Operações já mostrava os serviços
 * reais vindos do Laravel. O mesmo conceito com duas fontes e dois números --
 * e o do dinheiro era o errado, sem nada no ecrã a dizê-lo.
 *
 * Os filtros aplicam-se dos dois lados: no Supabase pela query, no Laravel em
 * memória. São poucos serviços e a alternativa era pedir ao Laravel filtros que
 * ele ainda não aceita.
 */
export async function servicosConcluidos(f: FinanceFilters): Promise<ServicoConcluido[]> {
  if (servicesFromLaravel()) {
    const todos = await fetchAllLaravelServices();
    const intervalo = f.period && f.period !== "personalizado" ? getDateRangeFromPreset(f.period) : null;
    return todos
      .filter((s) => s.status === "concluido")
      .filter((s) => (f.categoryId ? s.categoryId === f.categoryId : true))
      .filter((s) => (f.city ? s.city === f.city : true))
      .filter((s) => {
        if (!intervalo) return true;
        const t = Date.parse(s.requestedAt);
        return Number.isFinite(t) && t >= intervalo.start.getTime() && t <= intervalo.end.getTime();
      })
      .map((s) => ({
        id: s.id,
        piquet_revenue: Number(s.piquetRevenue) || 0,
        total_customer_value: Number(s.totalCustomerValue) || 0,
        technician_value: Number(s.technicianValue) || 0,
        // O comportamento de sempre: o mapa preenchia "nao_emitida" quando o
        // Laravel não mandava estado. Deixou de o inventar; o Financeiro
        // continua a ler o mesmo que lia.
        invoice_status: String(s.invoiceStatus ?? "nao_emitida"),
        payment_status: String(s.paymentStatus ?? ""),
        service_name: s.serviceName ?? "",
        vat_value: Number(s.vatValue) || 0,
        requested_at: s.requestedAt,
        completed_at: s.completedAt ?? null,
        customer_id: s.customerId ?? "",
        customer_name: s.customerName ?? "",
        category_id: s.categoryId ?? "",
        category_name: s.categoryName ?? "",
        city: s.city ?? "",
        technician_id: s.technicianId ?? "",
        technician_name: s.technicianName ?? "",
      }));
  }

  /*
    O nome da categoria vem por embed no Supabase e já vem pronto do Laravel.
    Achatado aqui para os dois lados devolverem a mesma coisa -- senão cada
    chamador teria de saber de onde os dados vieram, que é exactamente o que
    esta função existe para esconder.
  */
  const { data, error } = await completedQuery(
    "id, piquet_revenue, total_customer_value, technician_value, invoice_status, payment_status, service_name, vat_value, requested_at, completed_at, customer_id, customer_name, category_id, city, technician_id, technician_name, category:categories(name)",
    f,
  );
  if (error) throw new Error(error.message);
  type ComEmbed = Omit<ServicoConcluido, "category_name"> & { category?: { name?: string } | { name?: string }[] | null };
  return ((data ?? []) as ComEmbed[]).map((r) => {
    const cat = Array.isArray(r.category) ? r.category[0] : r.category;
    return { ...r, category_name: cat?.name ?? "" } as ServicoConcluido;
  });
}
