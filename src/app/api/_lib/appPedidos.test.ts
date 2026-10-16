/**
 * @vitest-environment node
 *
 * Os pedidos da app nos Contactos (appPedidos).
 *
 * A 15/10/2026 a sincronização dizia "100 lidos · 0 novos · 1 actualizados"
 * e calava o resto: 71 gravações falhavam (duas colunas por migrar), 28
 * pedidos tinham estados que ela não conhecia, e só lia a primeira página de
 * 263. Estes testes fixam as três coisas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, mockState, resetMock, setTable } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());
vi.mock("./laravelServices", async (original) => ({
  ...(await original<typeof import("./laravelServices")>()),
  servicesFromLaravel: () => true,
}));

let paginas: Array<Array<Record<string, unknown>>> = [];
const pedidos: string[] = [];
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string) => {
    pedidos.push(caminho);
    const n = Number(new URL(`http://x${caminho}`).searchParams.get("page") ?? 1);
    const total = paginas.reduce((t, p) => t + p.length, 0);
    return { items: paginas[n - 1] ?? [], meta: { total, last_page: paginas.length || 1 } };
  }),
}));

import { sincronizarPedidosDaApp, resumo, correuBem } from "./appPedidos";

const pedido = (id: number, status: string, extra: Record<string, unknown> = {}) => ({
  id, status, customer_name: `Cliente ${id}`, customer_phone: "912345678", city: "Almada",
  service_name: "Canalização", requested_at: "2026-10-15T10:00:00Z", ...extra,
});

const inseridos = () => mockState.inserts.filter((i) => i.table === "leads").map((i) => i.row as Record<string, unknown>);

beforeEach(() => {
  resetMock();
  pedidos.length = 0;
  paginas = [];
  setTable("leads", { data: [], error: null });
});

describe("pedidos da app nos Contactos", () => {
  it("lê todas as páginas, e não só os 100 mais recentes", async () => {
    paginas = [[pedido(3, "Closed")], [pedido(2, "Closed")], [pedido(1, "Closed")]];

    const r = await sincronizarPedidosDaApp();

    expect(pedidos).toEqual([
      "/v1/admin/services?per_page=100&page=1",
      "/v1/admin/services?per_page=100&page=2",
      "/v1/admin/services?per_page=100&page=3",
    ]);
    expect(r).toMatchObject({ lidos: 3, criados: 3, total: 3, falhados: 0 });
  });

  it("ao abrir a lista de Pedidos basta a primeira página", async () => {
    paginas = [[pedido(2, "Closed")], [pedido(1, "Closed")]];

    await sincronizarPedidosDaApp({ paginas: 1 });

    expect(pedidos).toHaveLength(1);
  });

  /** Agendado, no local, personalizado por rever, arquivado e os pagamentos que morreram. */
  it("conhece os estados que deixava de fora", async () => {
    paginas = [[
      pedido(1, "Scheduled"), pedido(2, "Arrived"), pedido(3, "PendingReview"), pedido(4, "Archived"),
      pedido(5, "RefusedMbway"), pedido(6, "ExpiredMbway"), pedido(7, "CanceledMbway"), pedido(8, "Expired3DS"),
    ]];

    const r = await sincronizarPedidosDaApp();

    expect(r.semEstado).toBe(0);
    expect(inseridos().map((l) => l.stage)).toEqual([
      "com_tecnico", "com_tecnico", "novo", "perdido", "perdido", "perdido", "perdido", "perdido",
    ]);
    expect(inseridos()[4]).toMatchObject({ loss_reason: "outro", loss_note: "MB Way recusado pelo cliente" });
  });

  /** "desistiu" não está na lista do CRM: o motivo aparecia em branco. */
  it("o motivo da perda é sempre um da lista do CRM", async () => {
    paginas = [[pedido(1, "Canceled"), pedido(2, "MatchingFailed")]];

    await sincronizarPedidosDaApp();

    expect(inseridos().map((l) => l.loss_reason)).toEqual(["outro", "sem_tecnico"]);
  });

  /** O caso de 15/10: o Supabase recusava e a sincronização dizia que estava tudo bem. */
  it("uma gravação que falha conta, diz porquê e o registo fica a vermelho", async () => {
    paginas = [[pedido(1, "Canceled"), pedido(2, "Canceled")]];
    setTable("leads", { data: null, error: { message: "column \"loss_reason\" of relation \"leads\" does not exist" } });

    const r = await sincronizarPedidosDaApp();

    expect(r).toMatchObject({ criados: 0, falhados: 2 });
    expect(resumo(r)).toContain("2 falharam ao gravar (column \"loss_reason\"");
    expect(correuBem(r)).toBe(false);
  });

  it("sem falhas, o registo fica verde", async () => {
    paginas = [[pedido(1, "Closed")]];

    expect(correuBem(await sincronizarPedidosDaApp())).toBe(true);
  });

  /** Um pedido que já está nos Contactos atualiza-se, e o motivo escrito à mão fica. */
  it("não apaga o motivo da perda escrito pela equipa", async () => {
    paginas = [[pedido(1, "Canceled")]];
    setTable("leads", { data: [{ id: "lead-1", laravel_service_id: "1", stage: "perdido", loss_reason: "preco" }], error: null });

    const r = await sincronizarPedidosDaApp();

    expect(r).toMatchObject({ atualizados: 1, criados: 0 });
    expect(inseridos()).toHaveLength(0);
    const atualizado = mockState.updates.find((u) => u.table === "leads")!.row as Record<string, unknown>;
    expect(atualizado.stage).toBe("perdido");
    expect(atualizado).not.toHaveProperty("loss_reason");
  });
});
