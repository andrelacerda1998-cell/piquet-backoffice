/**
 * @vitest-environment node
 *
 * Os lotes de pagamento de ponta a ponta, com um Supabase em memória e um
 * Laravel simulado: criar, aprovar (só outra pessoa), pagar (pelo valor do
 * lote, uma vez só), falhar e repetir, cancelar e conferir com o extrato.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------- Supabase em memória
type Linha = Record<string, unknown>;
const db: Record<string, Linha[]> = { payout_lotes: [], payout_lote_linhas: [], staff: [] };
let seq = 0;

function consulta(tabela: string) {
  const filtros: Array<(r: Linha) => boolean> = [];
  let acao: "select" | "insert" | "update" | "delete" = "select";
  let dados: Linha | Linha[] | null = null;
  let devolver = false;
  let unico = false;
  const q = {
    select() { devolver = true; return q; },
    insert(d: Linha | Linha[]) { acao = "insert"; dados = d; return q; },
    update(d: Linha) { acao = "update"; dados = d; return q; },
    delete() { acao = "delete"; return q; },
    eq(c: string, v: unknown) { filtros.push((r) => r[c] === v); return q; },
    in(c: string, vs: unknown[]) { filtros.push((r) => vs.includes(r[c])); return q; },
    order() { return q; },
    limit() { return q; },
    single() { unico = true; return q; },
    then(ok: (v: unknown) => void, erro?: (e: unknown) => void) {
      try { ok(executar()); } catch (e) { erro?.(e); }
    },
  };
  function executar() {
    const t = db[tabela];
    if (acao === "insert") {
      const novas = (Array.isArray(dados) ? dados : [dados!]).map((d) => ({
        id: `id-${++seq}`, criado_em: new Date().toISOString(), estado: tabela === "payout_lotes" ? "rascunho" : "por_pagar",
        erro: null, pago_em: null, confirmado_em: null, movimento: null, aprovado_por: null, aprovado_em: null, ...d,
      }));
      t.push(...novas);
      return { data: unico ? novas[0] : novas, error: null };
    }
    const alvo = t.filter((r) => filtros.every((f) => f(r)));
    if (acao === "update") {
      // A regra da base de dados: quem aprova não é quem criou.
      if (tabela === "payout_lotes" && (dados as Linha).aprovado_por && alvo.some((r) => r.criado_por === (dados as Linha).aprovado_por)) {
        return { data: null, error: { message: "payout_lotes_aprovador_diferente" } };
      }
      alvo.forEach((r) => Object.assign(r, dados));
      return { data: devolver ? alvo.map((r) => ({ id: r.id })) : null, error: null };
    }
    if (acao === "delete") { db[tabela] = t.filter((r) => !alvo.includes(r)); return { data: null, error: null }; }
    return { data: unico ? alvo[0] ?? null : alvo, error: null };
  }
  return q;
}

let staffAtual = { id: "andre", role: "ceo" };
vi.mock("@/lib/supabase/server", () => ({
  SUPABASE_ENABLED: true,
  supabaseAdmin: () => ({
    auth: { getUser: async () => ({ data: { user: { id: staffAtual.id } }, error: null }) },
    from: (t: string) => t === "staff"
      ? { select: () => ({ eq: () => ({ single: async () => ({ data: { role: staffAtual.role, email: `${staffAtual.id}@piquet.pt` } }) }) }) }
      : consulta(t),
  }),
}));

// ---------------------------------------------------- Laravel simulado
const saldos = new Map<number, number>([[1, 150], [2, 80]]);
const pagamentos: Array<{ vendor: number; amount: number }> = [];
let falharVendor: number | null = null;
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string, opts: { method?: string; body?: { amount: number } } = {}) => {
    if (caminho.startsWith("/v1/admin/vendor-payments?")) {
      return {
        items: [...saldos.entries()].filter(([, b]) => b > 0).map(([id, balance]) => ({
          id, vendor_name: id === 1 ? "Carlos Mendes" : "Rui Sousa", iban: `PT500000000000000000000${id}`, balance, payout_blocker: null,
        })),
        meta: { last_page: 1 },
      };
    }
    const m = caminho.match(/vendor-payments\/(\d+)\/pay$/);
    if (m && opts.method === "PUT") {
      const id = Number(m[1]);
      if (id === falharVendor) {
        const { ApiError } = await import("@/services/http");
        throw new ApiError("Pagamento retido: este técnico não tem IBAN.", 409);
      }
      pagamentos.push({ vendor: id, amount: opts.body!.amount });
      saldos.set(id, (saldos.get(id) ?? 0) - opts.body!.amount);
      return { amount_paid: opts.body!.amount, balance_left: saldos.get(id) };
    }
    throw new Error(`rota não simulada: ${caminho}`);
  }),
}));

import { GET, POST } from "./route";
import { POST as aprovar } from "./[id]/aprovar/route";
import { POST as pagar } from "./[id]/pagar/route";
import { POST as cancelar } from "./[id]/cancelar/route";
import { POST as conferirRota } from "./conferir/route";
import { _clearStaffCache } from "@/app/api/_lib/handler";

const como = (id: string, role = "ceo") => { staffAtual = { id, role }; _clearStaffCache(); };
const pedido = (caminho: string, body?: unknown) =>
  new Request(`http://x/api/finance/payout-lotes${caminho}`, { method: body === undefined ? "GET" : "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id = "") => ({ params: Promise.resolve({ id }) });
const json = async (r: Response) => ({ status: r.status, body: await r.json() });

async function criarLote(linhas = [{ vendor_id: 1, valor: 150 }, { vendor_id: 2, valor: 80 }]) {
  como("andre");
  const r = await json(await POST(pedido("", { linhas }), ctx()));
  expect(r.status).toBe(201);
  return r.body.data as { id: string; estado: string; total: number };
}

beforeEach(() => {
  db.payout_lotes = []; db.payout_lote_linhas = [];
  saldos.set(1, 150); saldos.set(2, 80);
  pagamentos.length = 0; falharVendor = null;
});

describe("lotes de pagamento", () => {
  it("criar não move dinheiro e fica em rascunho com o total", async () => {
    const lote = await criarLote();
    expect(lote.estado).toBe("rascunho");
    expect(lote.total).toBe(230);
    expect(pagamentos).toEqual([]);
  });

  it("não se cria com um valor acima do saldo", async () => {
    como("andre");
    const r = await json(await POST(pedido("", { linhas: [{ vendor_id: 1, valor: 151 }] }), ctx()));
    expect(r.status).toBe(422);
  });

  it("quem criou não aprova; outra pessoa sim", async () => {
    const lote = await criarLote();
    como("andre");
    expect((await aprovar(pedido(`/${lote.id}/aprovar`, {}), ctx(lote.id))).status).toBe(409);
    como("rodrigo", "cto");
    const r = await json(await aprovar(pedido(`/${lote.id}/aprovar`, {}), ctx(lote.id)));
    expect(r.status).toBe(200);
    expect(r.body.data.estado).toBe("aprovado");
  });

  it("não se paga um rascunho", async () => {
    const lote = await criarLote();
    expect((await pagar(pedido(`/${lote.id}/pagar`, {}), ctx(lote.id))).status).toBe(409);
    expect(pagamentos).toEqual([]);
  });

  it("paga cada técnico pelo valor do lote, e o que ganhou entretanto fica-lhe", async () => {
    const lote = await criarLote();
    como("rodrigo", "cto"); await aprovar(pedido(`/${lote.id}/aprovar`, {}), ctx(lote.id));
    saldos.set(1, 190); // ganhou 40 € depois de o lote ser aprovado

    como("andre");
    const r = await json(await pagar(pedido(`/${lote.id}/pagar`, {}), ctx(lote.id)));

    expect(pagamentos).toEqual([{ vendor: 1, amount: 150 }, { vendor: 2, amount: 80 }]);
    expect(saldos.get(1)).toBe(40);
    expect(r.body.data.estado).toBe("pago");
  });

  it("pagar duas vezes não paga duas vezes", async () => {
    const lote = await criarLote();
    como("rodrigo", "cto"); await aprovar(pedido(`/${lote.id}/aprovar`, {}), ctx(lote.id));
    como("andre");
    await pagar(pedido(`/${lote.id}/pagar`, {}), ctx(lote.id));
    await pagar(pedido(`/${lote.id}/pagar`, {}), ctx(lote.id));
    expect(pagamentos).toHaveLength(2);
  });

  it("dois cliques ao mesmo tempo também não pagam duas vezes", async () => {
    const lote = await criarLote();
    como("rodrigo", "cto"); await aprovar(pedido(`/${lote.id}/aprovar`, {}), ctx(lote.id));
    como("andre");
    await Promise.all([
      pagar(pedido(`/${lote.id}/pagar`, {}), ctx(lote.id)),
      pagar(pedido(`/${lote.id}/pagar`, {}), ctx(lote.id)),
    ]);
    expect(pagamentos).toHaveLength(2);
  });

  it("uma linha que falha fica com o motivo, o lote não fecha, e repetir paga só essa", async () => {
    const lote = await criarLote();
    como("rodrigo", "cto"); await aprovar(pedido(`/${lote.id}/aprovar`, {}), ctx(lote.id));
    falharVendor = 2;
    como("andre");
    const r1 = await json(await pagar(pedido(`/${lote.id}/pagar`, {}), ctx(lote.id)));
    expect(r1.body.data.estado).toBe("aprovado");
    expect(r1.body.data.linhas.find((l: { vendor_id: number }) => l.vendor_id === 2)).toMatchObject({ estado: "falhou", erro: "Pagamento retido: este técnico não tem IBAN." });

    falharVendor = null;
    const r2 = await json(await pagar(pedido(`/${lote.id}/pagar`, {}), ctx(lote.id)));
    expect(pagamentos).toEqual([{ vendor: 1, amount: 150 }, { vendor: 2, amount: 80 }]);
    expect(r2.body.data.estado).toBe("pago");
  });

  it("um técnico num lote aberto não entra noutro", async () => {
    await criarLote([{ vendor_id: 1, valor: 100 }]);
    como("andre");
    const r = await json(await POST(pedido("", { linhas: [{ vendor_id: 1, valor: 50 }] }), ctx()));
    expect(r.status).toBe(422);
    expect(r.body.error).toContain("já está noutro lote");
  });

  it("cancela-se enquanto nada foi pago, e depois deixa de se poder", async () => {
    const a = await criarLote([{ vendor_id: 1, valor: 100 }]);
    expect((await json(await cancelar(pedido(`/${a.id}/cancelar`, {}), ctx(a.id)))).body.data.estado).toBe("cancelado");

    const b = await criarLote([{ vendor_id: 2, valor: 80 }]);
    como("rodrigo", "cto"); await aprovar(pedido(`/${b.id}/aprovar`, {}), ctx(b.id));
    como("andre"); await pagar(pedido(`/${b.id}/pagar`, {}), ctx(b.id));
    expect((await cancelar(pedido(`/${b.id}/cancelar`, {}), ctx(b.id))).status).toBe(409);
  });

  it("a conferência marca as linhas pagas que estão no extrato e diz quais faltam", async () => {
    const lote = await criarLote();
    como("rodrigo", "cto"); await aprovar(pedido(`/${lote.id}/aprovar`, {}), ctx(lote.id));
    como("andre"); await pagar(pedido(`/${lote.id}/pagar`, {}), ctx(lote.id));

    const hoje = new Date().toISOString().slice(0, 10).split("-").reverse().join("-");
    const extrato = `Data Mov.;Descrição;Valor\n${hoje};TRF P/ CARLOS MENDES;-150,00\n`;
    const r = await json(await conferirRota(pedido("/conferir", { extrato }), ctx()));

    expect(r.body.data.conferidas).toBe(1);
    expect(r.body.data.porConferir.map((l: { vendor_name: string }) => l.vendor_name)).toEqual(["Rui Sousa"]);
    const lista = await json(await GET(pedido(""), ctx()));
    const linhas = lista.body.data.lotes[0].linhas;
    expect(linhas.find((l: { vendor_id: number }) => l.vendor_id === 1).estado).toBe("confirmado");
  });

  it("marketing não cria lotes", async () => {
    como("joana", "marketing");
    expect((await POST(pedido("", { linhas: [{ vendor_id: 1, valor: 10 }] }), ctx())).status).toBe(403);
  });
});
