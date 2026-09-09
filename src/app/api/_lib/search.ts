import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { fone9 } from "@/lib/despacho";

/**
 * Pesquisa global de ENTIDADES (não navegação): pedidos, clientes, técnicos,
 * pagamentos, faturas e tickets. Cada fonte é consultada em paralelo e
 * defensiva -- uma fonte indisponível não parte a pesquisa.
 *
 * Clientes e técnicos vêm do LARAVEL (09/09/2026). Antes procuravam-se nas
 * tabelas `customers` e `technicians` de Supabase, que têm uma linha cada: a
 * operação real vive no Laravel, e quem usava a pesquisa para resolver um caso
 * ao telefone não encontrava a pessoa que tinha do outro lado.
 *
 * O telefone procura-se pelos últimos 9 dígitos, porque o mesmo número aparece
 * com e sem indicativo conforme tenha entrado pela app, pela landing ou pela
 * Meta.
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
      if (!LARAVEL_ADMIN_ENABLED) return;
      const r = await laravelAdminRequest<{ items?: { id: number | string; name?: string | null; email?: string | null; phone_number?: string | null; nif?: string | null }[] }>(
        `/v1/admin/customers?per_page=6&search=${encodeURIComponent(q)}`);
      for (const c of r.items ?? []) out.push({
        type: "customer", typeLabel: "Cliente", id: String(c.id),
        title: c.name || "(sem nome)", subtitle: join([c.phone_number, c.email]), href: "/clientes",
      });
    }),
    safe(async () => {
      if (!LARAVEL_ADMIN_ENABLED) return;
      const r = await laravelAdminRequest<{ items?: { id: number | string; name?: string | null; phone_number?: string | null; nif?: string | null }[] }>(
        `/v1/admin/vendors?per_page=6&search=${encodeURIComponent(q)}`);
      for (const t of r.items ?? []) out.push({
        type: "technician", typeLabel: "Técnico", id: String(t.id),
        title: t.name || "(sem nome)", subtitle: join([t.phone_number, t.nif]), href: "/tecnicos",
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
      /*
        Os últimos 9 dígitos quando o termo é um telefone: "934670597" e
        "351934670597" são a mesma pessoa, e escrever o indicativo ou não devia
        ser indiferente para quem procura.
      */
      const p9 = fone9(q);
      const filtro = p9.length === 9
        ? `name.ilike.${like},phone9.eq.${p9}`
        : `name.ilike.${like},phone.ilike.${like},city.ilike.${like}`;
      const { data } = await admin.from("leads").select("id, name, phone, city").or(filtro).limit(6);
      for (const l of data ?? []) out.push({
        type: "lead", typeLabel: "Pedido", id: String(l.id),
        title: l.name || "(sem nome)", subtitle: join([l.phone, l.city]), href: `/leads?lead=${l.id}`,
      });
    }),
    safe(async () => {
      /*
        Pagamentos pela referência. É o que se tem na mão quando um cliente
        liga a dizer que pagou -- e era a única coisa que a pesquisa não sabia
        procurar de todo.
      */
      const { data } = await admin.from("pop_transactions")
        .select("uuid, customer_ext_id, amount_cents, operative, created_at")
        .or(`uuid.ilike.${like},customer_ext_id.ilike.${like}`).limit(6);
      for (const t of (data ?? []) as { uuid: string; customer_ext_id: string | null; amount_cents: number | null }[]) {
        out.push({
          type: "invoice", typeLabel: "Pagamento", id: String(t.uuid),
          title: t.amount_cents != null ? `${(t.amount_cents / 100).toFixed(2).replace(".", ",")} €` : t.uuid,
          subtitle: join([t.customer_ext_id, t.uuid.slice(0, 8)]), href: "/financeiro?tab=pagamentos",
        });
      }
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
