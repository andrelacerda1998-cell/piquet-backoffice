import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Pesquisa global de ENTIDADES (não navegação): serviços, clientes, técnicos,
 * faturas, leads e tickets. Cada fonte é consultada em paralelo e defensiva
 * (uma tabela em falta não parte a pesquisa). À medida que os dados reais
 * ligam (Laravel), passa a encontrar mais — a infraestrutura fica igual.
 */
export type SearchType = "service" | "customer" | "technician" | "invoice" | "lead" | "ticket";

export interface SearchResult {
  type: SearchType;
  typeLabel: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");
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
      const { data } = await admin.from("services")
        .select("id, service_name, customer_name, technician_name, city")
        .or(`id.ilike.${like},service_name.ilike.${like},customer_name.ilike.${like},technician_name.ilike.${like},city.ilike.${like}`)
        .limit(6);
      for (const s of data ?? []) out.push({
        type: "service", typeLabel: "Serviço", id: String(s.id),
        title: s.service_name || s.customer_name || String(s.id),
        subtitle: join([s.customer_name, s.technician_name, s.city]), href: "/servicos",
      });
    }),
    safe(async () => {
      const { data } = await admin.from("customers").select("id, name, email, phone")
        .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).limit(6);
      for (const c of data ?? []) out.push({
        type: "customer", typeLabel: "Cliente", id: String(c.id),
        title: c.name || "(sem nome)", subtitle: join([c.phone, c.email]), href: "/clientes",
      });
    }),
    safe(async () => {
      const { data } = await admin.from("technicians").select("id, name, email, phone")
        .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).limit(6);
      for (const t of data ?? []) out.push({
        type: "technician", typeLabel: "Técnico", id: String(t.id),
        title: t.name || "(sem nome)", subtitle: join([t.phone, t.email]), href: "/tecnicos",
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
        type: "lead", typeLabel: "Lead", id: String(l.id),
        title: l.name || "(sem nome)", subtitle: join([l.phone, l.city]), href: "/marketing?tab=crm",
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
