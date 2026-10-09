import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { servicesFromLaravel } from "./laravelServices";
import { cumpre, type Requisito } from "@/lib/acessoApi";

/**
 * Pesquisa global de ENTIDADES (não navegação): serviços, clientes, técnicos,
 * faturas, leads e tickets. Cada fonte é consultada em paralelo e defensiva
 * (uma fonte em baixo não parte a pesquisa).
 *
 * Técnicos, clientes e serviços vêm do LARAVEL, que é onde estão.
 *
 * Durante meses vieram das tabelas locais `technicians`, `customers` e
 * `services` -- que têm UMA linha cada, sobra de antes da ponte existir.
 * Procurar um dos 438 técnicos pelo nome devolvia nada, na caixa de pesquisa
 * mais visível do produto. As tabelas locais ficam como recurso para quando o
 * Laravel não estiver ligado.
 */
export type SearchType = "service" | "customer" | "technician" | "invoice" | "lead" | "ticket";

/**
 * O que cada perfil pode ver nos resultados. A pesquisa está aberta a todo o
 * staff, e sem isto devolvia a qualquer conta clientes, faturas e tickets
 * que o próprio ecrã lhe esconde.
 */
export const PERMISSAO_DO_RESULTADO: Record<SearchType, Requisito> = {
  service: { qualquer: ["view_services"] },
  customer: { qualquer: ["view_customers"] },
  technician: { qualquer: ["view_technicians"] },
  invoice: { qualquer: ["view_finance"] },
  lead: { qualquer: ["view_marketing", "view_customers"] },
  ticket: { qualquer: ["view_support"] },
};

/** Só os resultados que este perfil pode ver. */
export function resultadosVisiveis<T extends { type: SearchType }>(role: string, resultados: T[]): T[] {
  return resultados.filter((r) => cumpre(role, PERMISSAO_DO_RESULTADO[r.type]));
}

export interface SearchResult {
  type: SearchType;
  typeLabel: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");
/**
 * O endereço que abre a ficha de um registo (ver useAbrirPeloEndereco). O
 * nome vai junto porque a página só tem a lista com pesquisa: procura por ele
 * e abre a ficha quando o registo aparece.
 */
export function fichaHref(base: string, chave: string, id: unknown, nome: unknown): string {
  /*
    Com um id do Laravel (só números), a ficha tem endereço próprio:
    /clientes/412, /tecnicos/94 (desde 09/10/2026). O formato antigo, com a
    pesquisa pelo nome, fica para ids que não sejam números.
  */
  if (/^\d+$/.test(String(id))) return `${base.split("?")[0]}/${id}`;
  const url = new URL(base, "http://x");
  url.searchParams.set(chave, String(id));
  const q = typeof nome === "string" ? nome.trim() : "";
  if (q) url.searchParams.set("q", q);
  return url.pathname + url.search;
}

async function safe(fn: () => Promise<void>) { try { await fn(); } catch { /* fonte indisponível — ignora */ } }

export async function searchEntities(raw: string): Promise<{ results: SearchResult[] }> {
  // Sanitiza: `%` e `,` partiriam o filtro `.or(...ilike...)` do PostgREST.
  const q = raw.replace(/[%,]/g, " ").trim();
  if (q.length < 2) return { results: [] };
  const like = `%${q}%`;
  const admin = supabaseAdmin();
  const out: SearchResult[] = [];

  await Promise.all([
    safe(async () => {
      if (servicesFromLaravel()) {
        const r = await laravelAdminRequest<{ items: Array<Record<string, unknown>> }>(
          `/v1/admin/services?per_page=6&search=${encodeURIComponent(q)}`,
        );
        for (const s of r.items ?? []) out.push({
          type: "service", typeLabel: "Serviço", id: String(s.id),
          // O número à frente: é o que o cliente diz ao telefone.
          title: `#${s.id} · ${String(s.service_name || s.customer_name || "Serviço")}`,
          subtitle: join([s.customer_name as string, s.technician_name as string, s.city as string]),
          href: `/servicos?servico=${encodeURIComponent(String(s.id))}`,
        });
        return;
      }
      const { data } = await admin.from("services")
        .select("id, service_name, customer_name, technician_name, city")
        .or(`id.ilike.${like},service_name.ilike.${like},customer_name.ilike.${like},technician_name.ilike.${like},city.ilike.${like}`)
        .limit(6);
      for (const s of data ?? []) out.push({
        type: "service", typeLabel: "Serviço", id: String(s.id),
        title: s.service_name || s.customer_name || String(s.id),
        subtitle: join([s.customer_name, s.technician_name, s.city]),
        href: `/servicos?servico=${encodeURIComponent(String(s.id))}`,
      });
    }),
    safe(async () => {
      if (LARAVEL_ADMIN_ENABLED) {
        const r = await laravelAdminRequest<{ items: Array<Record<string, unknown>> }>(
          `/v1/admin/customers?per_page=6&search=${encodeURIComponent(q)}`,
        );
        for (const c of r.items ?? []) out.push({
          type: "customer", typeLabel: "Cliente", id: String(c.id),
          title: String(c.name || "(sem nome)"),
          subtitle: join([c.phone_number as string, c.email as string]),
          href: fichaHref("/clientes?tab=lista", "cliente", c.id, c.name),
        });
        return;
      }
      const { data } = await admin.from("customers").select("id, name, email, phone")
        .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).limit(6);
      for (const c of data ?? []) out.push({
        type: "customer", typeLabel: "Cliente", id: String(c.id),
        title: c.name || "(sem nome)", subtitle: join([c.phone, c.email]),
        href: fichaHref("/clientes?tab=lista", "cliente", c.id, c.name),
      });
    }),
    safe(async () => {
      if (LARAVEL_ADMIN_ENABLED) {
        const r = await laravelAdminRequest<{ items: Array<Record<string, unknown>> }>(
          `/v1/admin/vendors?per_page=6&search=${encodeURIComponent(q)}`,
        );
        for (const t of r.items ?? []) out.push({
          type: "technician", typeLabel: "Técnico", id: String(t.id),
          title: String(t.name || "(sem nome)"),
          subtitle: join([t.phone_number as string, t.nif as string]),
          href: fichaHref("/tecnicos?tab=lista", "tecnico", t.id, t.name),
        });
        return;
      }
      const { data } = await admin.from("technicians").select("id, name, email, phone")
        .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).limit(6);
      for (const t of data ?? []) out.push({
        type: "technician", typeLabel: "Técnico", id: String(t.id),
        title: t.name || "(sem nome)", subtitle: join([t.phone, t.email]),
        href: fichaHref("/tecnicos?tab=lista", "tecnico", t.id, t.name),
      });
    }),
    safe(async () => {
      const { data } = await admin.from("company_invoices").select("id, vendor, description")
        .or(`vendor.ilike.${like},description.ilike.${like}`).limit(6);
      for (const f of data ?? []) out.push({
        type: "invoice", typeLabel: "Fatura", id: String(f.id),
        title: f.vendor || "(sem fornecedor)", subtitle: f.description || "", href: "/financeiro?tab=custos",
      });
    }),
    safe(async () => {
      const { data } = await admin.from("leads").select("id, name, phone, city")
        .or(`name.ilike.${like},phone.ilike.${like},city.ilike.${like}`).limit(6);
      for (const l of data ?? []) out.push({
        type: "lead", typeLabel: "Contacto", id: String(l.id),
        title: l.name || "(sem nome)", subtitle: join([l.phone, l.city]), href: "/leads",
      });
    }),
    safe(async () => {
      const { data } = await admin.from("support_tickets").select("id, subject, requester_name, requester_email")
        .or(`subject.ilike.${like},requester_name.ilike.${like},requester_email.ilike.${like}`).limit(6);
      for (const t of data ?? []) out.push({
        type: "ticket", typeLabel: "Ticket", id: String(t.id),
        title: t.subject || t.requester_name || String(t.id),
        subtitle: join([t.requester_name, t.requester_email]), href: `/suporte?ticket=${t.id}`,
      });
    }),
  ]);

  return { results: out.slice(0, 24) };
}
