import "server-only";
import { fichaHref, pedidoHref } from "@/lib/fichas";
import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { servicesFromLaravel, mapLaravelService, type LaravelServiceRow } from "./laravelServices";
import { derivePaymentState, chargedCents, paymentKey, type PaymentState } from "./paylands";
import { invoiceStatusOf } from "./companyInvoices";
import { estadoSimplesDe, precisaDeAtencao, rotuloSimples } from "@/lib/estados";
import { ESTADOS_DO_TICKET } from "@/lib/tickets";
import type { StatusTone } from "@/lib/formatters";
import type { ServiceRequest } from "@/types";
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
export type SearchType = "service" | "customer" | "technician" | "payment" | "lead" | "ticket" | "invoice";

/** A ordem em que os grupos aparecem no ⌘K: do que mais se procura ao que menos. */
export const ORDEM_DOS_TIPOS: SearchType[] = ["service", "customer", "technician", "payment", "lead", "ticket", "invoice"];

/**
 * O que cada perfil pode ver nos resultados. A pesquisa está aberta a todo o
 * staff, e sem isto devolvia a qualquer conta clientes, faturas e tickets
 * que o próprio ecrã lhe esconde.
 */
export const PERMISSAO_DO_RESULTADO: Record<SearchType, Requisito> = {
  service: { qualquer: ["view_services"] },
  customer: { qualquer: ["view_customers"] },
  technician: { qualquer: ["view_technicians"] },
  payment: { qualquer: ["view_finance"] },
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
  /** O estado ao lado do resultado ("À espera do cliente", "Bloqueado"…), com a cor dele. */
  estado?: string;
  tom?: StatusTone;
}

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");
// O endereço das fichas vive em lib/fichas (usado também pela ficha do pedido).
export { fichaHref };

/**
 * O estado de uma fatura de custos, como o Financeiro o mostra. Não há coluna
 * de estado: deriva do que já foi pago face ao total (ver companyInvoices.ts).
 */
export function estadoDaFatura(valor: unknown, pago: unknown): { estado: string; tom: StatusTone } {
  const s = invoiceStatusOf(Number(valor) || 0, Number(pago) || 0);
  if (s === "pago") return { estado: "Paga", tom: "success" };
  return { estado: s === "parcial" ? "Paga em parte" : "Por pagar", tom: "warning" };
}

async function safe(fn: () => Promise<void>) { try { await fn(); } catch { /* fonte indisponível — ignora */ } }

/*
  O que a pessoa escreveu, lido de várias maneiras. Ao telefone diz-se
  "912 345 678" e a base de dados tem "+351912345678": compara-se pelos
  dígitos (os últimos 9, que são a identidade de um número português).
*/
export function lerPesquisa(raw: string) {
  // `%`, `,` e os parênteses partiriam o filtro `.or(...)` do PostgREST.
  const q = raw.replace(/[%,()*]/g, " ").replace(/\s+/g, " ").trim();
  const digitos = q.replace(/\D/g, "");
  const numeroDePedido = /^#?\d{1,8}$/.test(q) ? q.replace("#", "") : null;
  const pareceTelefone = /^[+\d\s().-]+$/.test(raw.trim()) && digitos.length >= 6;
  const telefone9 = pareceTelefone ? digitos.slice(-9) : null;
  // Um id de pagamento do Payshop é um uuid: 8+ caracteres hexadecimais (com ou sem hífenes).
  const pareceUuid = /^[0-9a-f-]{8,}$/i.test(q) && /[a-f]/i.test(q) && /\d/.test(q);
  return { q, digitos, numeroDePedido, telefone9, pareceUuid, email: q.includes("@") };
}

const LEAD_ESTADO: Record<string, { label: string; tom: StatusTone }> = {
  novo: { label: "Novo", tom: "warning" },
  a_procurar: { label: "À procura de técnico", tom: "warning" },
  com_tecnico: { label: "Com técnico", tom: "info" },
  concluido: { label: "Concluído", tom: "success" },
  perdido: { label: "Perdido", tom: "neutral" },
};

const PAGAMENTO_ESTADO: Record<PaymentState, { label: string; tom: StatusTone }> = {
  pago: { label: "Cobrado", tom: "success" },
  cativado: { label: "Cativo", tom: "info" },
  cancelado: { label: "Libertado", tom: "neutral" },
  reembolsado: { label: "Reembolsado", tom: "warning" },
  recusado: { label: "Falhou", tom: "danger" },
};

const euros = (cents: number) => (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

/** O estado de um pedido para o ⌘K: o simples, com a cor (vermelho se precisa de alguém). */
function estadoDoPedido(s: ServiceRequest): { estado: string; tom: StatusTone } {
  return { estado: rotuloSimples(s.status), tom: precisaDeAtencao(s.status) ? "danger" : estadoSimplesDe(s.status)?.tom ?? "neutral" };
}

function resultadoDoPedido(s: ServiceRequest): SearchResult {
  return {
    type: "service", typeLabel: "Pedido", id: s.id,
    // O número à frente: é o que o cliente diz ao telefone.
    title: `#${s.id} · ${s.serviceName || s.customerName || "Pedido"}`,
    subtitle: join([s.customerName, s.technicianName, s.city]),
    href: pedidoHref(s.id),
    ...estadoDoPedido(s),
  };
}

export async function searchEntities(raw: string): Promise<{ results: SearchResult[] }> {
  const p = lerPesquisa(raw);
  const { q } = p;
  if (q.length < 2 && !p.numeroDePedido) return { results: [] };
  const like = `%${q}%`;
  // No Laravel, um telefone vai só com os dígitos (com ou sem espaços, com ou sem +351).
  const paraLaravel = encodeURIComponent(p.telefone9 ?? q);
  const admin = supabaseAdmin();
  const out: SearchResult[] = [];

  await Promise.all([
    // O pedido com ESSE número, lido diretamente: na lista podia ficar atrás de
    // pedidos mais recentes cujo telefone também tem "282".
    safe(async () => {
      if (!p.numeroDePedido || !servicesFromLaravel()) return;
      const d = await laravelAdminRequest<LaravelServiceRow>(`/v1/admin/services/${p.numeroDePedido}`);
      out.push({ ...resultadoDoPedido(mapLaravelService({ ...d, candidates: null })), exato: true } as SearchResult);
    }),
    safe(async () => {
      if (servicesFromLaravel()) {
        const r = await laravelAdminRequest<{ items: LaravelServiceRow[] }>(
          `/v1/admin/services?per_page=6&search=${paraLaravel}`,
        );
        for (const s of r.items ?? []) out.push(resultadoDoPedido(mapLaravelService(s)));
        return;
      }
      const { data } = await admin.from("services")
        .select("id, service_name, customer_name, technician_name, city")
        .or(`id.ilike.${like},service_name.ilike.${like},customer_name.ilike.${like},technician_name.ilike.${like},city.ilike.${like}`)
        .limit(6);
      for (const s of data ?? []) out.push({
        type: "service", typeLabel: "Pedido", id: String(s.id),
        title: s.service_name || s.customer_name || String(s.id),
        subtitle: join([s.customer_name, s.technician_name, s.city]),
        href: pedidoHref(String(s.id)),
      });
    }),
    safe(async () => {
      if (LARAVEL_ADMIN_ENABLED) {
        // Também os bloqueados: é muitas vezes por causa deles que se procura.
        const r = await laravelAdminRequest<{ items: Array<Record<string, unknown>> }>(
          `/v1/admin/customers?per_page=6&incluir_bloqueados=1&search=${paraLaravel}`,
        );
        for (const c of r.items ?? []) out.push({
          type: "customer", typeLabel: "Cliente", id: String(c.id),
          title: String(c.name || "(sem nome)"),
          subtitle: join([c.phone_number as string, c.email as string]),
          href: fichaHref("/clientes?tab=lista", "cliente", c.id, c.name),
          ...(c.blocked_at ? { estado: "Bloqueado", tom: "danger" as const } : {}),
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
          `/v1/admin/vendors?per_page=6&incluir_suspensos=1&search=${paraLaravel}`,
        );
        for (const t of r.items ?? []) out.push({
          type: "technician", typeLabel: "Técnico", id: String(t.id),
          title: String(t.name || "(sem nome)"),
          subtitle: join([t.phone_number as string, t.nif as string]),
          href: fichaHref("/tecnicos?tab=lista", "tecnico", t.id, t.name),
          ...estadoDoTecnico(t),
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
    // Um pagamento pelo id do Payshop (o que aparece no extrato e nos emails do Paylands).
    safe(async () => {
      if (!p.pareceUuid) return;
      const { data } = await admin.from("pop_transactions")
        .select("order_uuid, transaction_uuid, amount_cents, status, type, created")
        .ilike("order_uuid", `${q.toLowerCase()}%`)
        .order("created", { ascending: false })
        .limit(30);
      const porPagamento = new Map<string, Array<{ type: string; status: string; amount_cents: number; created: string | null }>>();
      for (const t of data ?? []) {
        const k = paymentKey(t);
        porPagamento.set(k, [...(porPagamento.get(k) ?? []), t]);
      }
      const uuids = [...porPagamento.keys()].slice(0, 4);
      // O pedido de cada pagamento (backend: GET /payment-orders?uuids=…). Sem ele, leva ao Financeiro.
      const pedidoDe = new Map<string, string>();
      if (LARAVEL_ADMIN_ENABLED && uuids.length) {
        await safe(async () => {
          const r = await laravelAdminRequest<Array<{ uuid: string; service_id: number | null }> | { items?: Array<{ uuid: string; service_id: number | null }> }>(
            `/v1/admin/payment-orders?uuids=${uuids.map(encodeURIComponent).join(",")}`,
          );
          const lista = Array.isArray(r) ? r : r.items ?? [];
          for (const o of lista) if (o.service_id) pedidoDe.set(o.uuid.toUpperCase(), String(o.service_id));
        });
      }
      for (const uuid of uuids) {
        const txs = porPagamento.get(uuid) ?? [];
        const estado = PAGAMENTO_ESTADO[derivePaymentState(txs)];
        const pedido = pedidoDe.get(uuid.toUpperCase());
        const quando = txs.map((t) => t.created).filter(Boolean).sort()[0];
        out.push({
          type: "payment", typeLabel: "Pagamento", id: uuid,
          title: `Pagamento de ${euros(chargedCents(txs))}`,
          subtitle: join([pedido ? `pedido #${pedido}` : null, quando ? new Date(quando).toLocaleDateString("pt-PT") : null, uuid.slice(0, 8)]),
          href: pedido ? pedidoHref(pedido) : "/financeiro?tab=pagamentos",
          estado: estado.label, tom: estado.tom,
        });
      }
    }),
    safe(async () => {
      const filtros = [`name.ilike.${like}`, `city.ilike.${like}`, `email.ilike.${like}`];
      // Pelo telefone, pelos dígitos (a landing grava "934670597", a Meta "351934670597").
      if (p.telefone9) filtros.push(`phone9.like.%${p.telefone9}%`);
      else filtros.push(`phone.ilike.${like}`);
      const { data } = await admin.from("leads").select("id, name, phone, city, stage")
        .or(filtros.join(",")).limit(6);
      for (const l of data ?? []) {
        const e = LEAD_ESTADO[String(l.stage)] ?? null;
        out.push({
          type: "lead", typeLabel: "Contacto", id: String(l.id),
          title: l.name || "(sem nome)", subtitle: join([l.phone, l.city]),
          href: `/leads?lead=${encodeURIComponent(String(l.id))}`,
          ...(e ? { estado: e.label, tom: e.tom } : {}),
        });
      }
    }),
    safe(async () => {
      const filtros = [`id.ilike.${like}`, `subject.ilike.${like}`, `requester_name.ilike.${like}`, `requester_email.ilike.${like}`];
      if (p.telefone9) filtros.push(`requester_phone.ilike.%${p.telefone9}%`);
      const { data } = await admin.from("support_tickets").select("id, subject, requester_name, requester_email, status, service_id")
        .or(filtros.join(",")).limit(6);
      for (const t of data ?? []) out.push({
        type: "ticket", typeLabel: "Ticket", id: String(t.id),
        title: t.subject || t.requester_name || String(t.id),
        subtitle: join([String(t.id), t.requester_name, t.service_id ? `pedido #${t.service_id}` : null]),
        href: `/suporte?ticket=${encodeURIComponent(String(t.id))}`,
        estado: ESTADOS_DO_TICKET[String(t.status)] ?? undefined,
        tom: t.status === "novo" ? "warning" : t.status === "resolvido" || t.status === "fechado" ? "neutral" : "info",
      });
    }),
    safe(async () => {
      const { data } = await admin.from("company_invoices").select("id, vendor, description, amount, amount_paid")
        .or(`vendor.ilike.${like},description.ilike.${like}`).limit(6);
      for (const f of data ?? []) out.push({
        type: "invoice", typeLabel: "Fatura", id: String(f.id),
        title: f.vendor || "(sem fornecedor)", subtitle: f.description || "", href: "/financeiro?tab=custos",
        ...estadoDaFatura(f.amount, f.amount_paid),
      });
    }),
  ]);

  return { results: ordenar(out) };
}

/**
 * Os resultados agrupados por tipo, numa ordem fixa, com o pedido exato à
 * cabeça e sem repetidos. Não se corta aqui: cada fonte já traz no máximo 6,
 * e o corte vinha ANTES do filtro do perfil -- uma fonte lenta podia ficar de
 * fora e outra ocupar o lugar de resultados que o perfil nem podia ver.
 */
export function ordenar(resultados: SearchResult[]): SearchResult[] {
  const vistos = new Set<string>();
  const exatos = resultados.filter((r) => (r as { exato?: boolean }).exato);
  const unicos = [...exatos, ...resultados].filter((r) => {
    const k = `${r.type}:${r.id}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  const pos = (t: SearchType) => ORDEM_DOS_TIPOS.indexOf(t);
  return unicos
    .map((r, i) => ({ r, i }))
    .sort((a, b) => pos(a.r.type) - pos(b.r.type) || a.i - b.i)
    .map(({ r }) => { const { exato: _exato, ...resto } = r as SearchResult & { exato?: boolean }; return resto; });
}

/** Um técnico suspenso, online ou à espera de aprovação, como o backend o diz. */
function estadoDoTecnico(t: Record<string, unknown>): { estado?: string; tom?: StatusTone } {
  if (t.suspended_at || t.deleted_at) return { estado: "Suspenso", tom: "danger" };
  const e = typeof t.estado === "string" ? t.estado : null;
  if (e === "online") return { estado: "Online", tom: "success" };
  if (e === "pronto") return { estado: "Pronto", tom: "info" };
  if (e === "em_aprovacao") return { estado: "Em aprovação", tom: "warning" };
  return {};
}
