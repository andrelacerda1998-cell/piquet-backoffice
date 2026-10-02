/**
 * @vitest-environment node
 *
 * AS CONTAS DO FUNIL DOS TÉCNICOS.
 *
 * Este ecrã já deu números errados três vezes, e sempre do mesmo feitio: um
 * número sozinho parece bem, e só encostado a outro é que se vê que não pode
 * ser. Por isso o que se testa aqui não são valores — são INVARIANTES, as
 * relações que têm de se manter quaisquer que sejam os dados:
 *
 *  - cada técnico conta num degrau e só num; a soma dos degraus é o total;
 *  - quem pode aceitar serviço tem, forçosamente, o perfil completo;
 *  - um código de bloqueio que este código não conheça aparece em
 *    `desconhecido` e NUNCA dentro de «nada em falta» (foi exactamente isso
 *    que aconteceu quando o Laravel acrescentou `at_user_missing`);
 *  - as páginas são todas percorridas (a lista do Laravel trava em 100).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock } from "@/test/supabaseMock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

const paginas: Array<Record<string, unknown>[]> = [];
const pedidos: string[] = [];

vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string) => {
    pedidos.push(caminho);
    const n = Number(new URL(`http://x${caminho}`).searchParams.get("page") ?? 1);
    return { items: paginas[n - 1] ?? [], meta: { last_page: paginas.length || 1 } };
  }),
}));

import { GET } from "./route";
import { _clearStaffCache } from "@/app/api/_lib/handler";

/** Um técnico que passou tudo — a base sobre a qual cada cenário muda uma coisa. */
const completo = (extra: Record<string, unknown> = {}) => ({
  id: 1, name: "Técnico", at_user: "sub/user", invoice_workspace: "ws-1",
  account_blocker: null, can_accept_service: true, all_documents_verified: true,
  created_at: "2026-01-01T00:00:00Z", ...extra,
});

async function correr(lista: Array<Record<string, unknown>>[]) {
  paginas.length = 0;
  paginas.push(...lista);
  const res = await GET(
    new Request("http://x/api/technicians/funil", { headers: { authorization: "Bearer tok" } }),
    { params: Promise.resolve({}) },
  );
  expect(res.status).toBe(200);
  return (await res.json()).data as {
    items: unknown[];
    contagem: {
      total: number; comWorkspace: number; aEspera: number; bloqueados: number;
      perfilCompleto: number; podemAceitar: number; soFaltaAT: number; contactoPorVerificar: number;
      degraus: Record<string, number>;
    };
  };
}

beforeEach(() => { pedidos.length = 0; _clearStaffCache(); });

describe("funil dos técnicos — invariantes das contas", () => {
  /**
   * A invariante que mais vale: se a soma dos degraus não der o total, há
   * técnicos a cair fora da conta — e ninguém nota, porque o que falta num
   * sítio aparece a menos noutro.
   */
  it("cada técnico conta num degrau e só num", async () => {
    const { contagem } = await correr([[
      completo({ id: 1 }),
      completo({ id: 2, account_blocker: "contact_unverified", can_accept_service: false, all_documents_verified: false }),
      completo({ id: 3, account_blocker: "documents_pending", can_accept_service: false, all_documents_verified: false }),
      completo({ id: 4, account_blocker: "iban_missing", can_accept_service: false }),
      completo({ id: 5, account_blocker: "fiscal_address_missing", can_accept_service: false }),
      completo({ id: 6, account_blocker: "at_user_missing", can_accept_service: false, at_user: null }),
    ]]);

    const soma = Object.values(contagem.degraus)
      // `semContactoRecentes` é um SUBCONJUNTO de `semContacto`, não um degrau.
      .reduce((a, b) => a + b, 0) - contagem.degraus.semContactoRecentes;

    expect(contagem.total).toBe(6);
    expect(soma).toBe(contagem.total);
  });

  it("quem pode aceitar serviço tem sempre o perfil completo", async () => {
    const { contagem } = await correr([[
      completo({ id: 1 }),
      completo({ id: 2, can_accept_service: false }),                       // completo, mas travado noutra coisa
      completo({ id: 3, invoice_workspace: null, can_accept_service: false }),
      completo({ id: 4, all_documents_verified: false, can_accept_service: false, account_blocker: "documents_pending" }),
    ]]);

    expect(contagem.podemAceitar).toBeLessThanOrEqual(contagem.perfilCompleto);
    expect(contagem.perfilCompleto).toBeLessThanOrEqual(contagem.total);
  });

  it("o perfil completo exige as DUAS coisas, não uma", async () => {
    const { contagem } = await correr([[
      completo({ id: 1 }),                                                   // documentos + workspace
      completo({ id: 2, invoice_workspace: null, can_accept_service: false }), // só documentos
      completo({ id: 3, all_documents_verified: false, can_accept_service: false, account_blocker: "documents_pending" }),
    ]]);

    expect(contagem.perfilCompleto).toBe(1);
  });

  /**
   * A regressão de 30/09: o Laravel acrescentou `at_user_missing` e este
   * código não sabia dele. O `default` do switch contava-o como «nada em
   * falta» — gente travada apresentada como gente pronta.
   */
  it("um código de bloqueio desconhecido não se esconde dentro de «nada em falta»", async () => {
    const { contagem } = await correr([[
      completo({ id: 1, account_blocker: "codigo_que_ainda_nao_existe", can_accept_service: false }),
    ]]);

    expect(contagem.degraus.desconhecido).toBe(1);
    expect(contagem.degraus.nadaEmFalta).toBe(0);
  });

  it("sem bloqueio nenhum, conta em «nada em falta»", async () => {
    const { contagem } = await correr([[completo({ id: 1 })]]);

    expect(contagem.degraus.nadaEmFalta).toBe(1);
    expect(contagem.degraus.desconhecido).toBe(0);
  });
});

describe("funil dos técnicos — de onde vêm os documentos validados", () => {
  /**
   * Com o campo verdadeiro (backend #127) não há incerteza a anunciar: o
   * `contactoPorVerificar` é a margem de erro da DEDUÇÃO, e sem dedução é
   * zero. Mostrá-lo na mesma dava um aviso de imprecisão a um número exacto.
   */
  it("com o campo do Laravel, não há margem de erro a declarar", async () => {
    const { contagem } = await correr([[
      completo({ id: 1, account_blocker: "contact_unverified", can_accept_service: false, all_documents_verified: false }),
    ]]);

    expect(contagem.contactoPorVerificar).toBe(0);
    expect(contagem.degraus.semContacto).toBe(1);
  });

  it("sem o campo, deduz pelo bloqueio e assume a imprecisão", async () => {
    const semCampo = { ...completo({ id: 1, account_blocker: "contact_unverified", can_accept_service: false }) };
    delete (semCampo as Record<string, unknown>).all_documents_verified;

    const { contagem } = await correr([[semCampo]]);

    expect(contagem.contactoPorVerificar).toBe(1);
  });

  /**
   * `iban_missing` e `fiscal_address_missing` vêm DEPOIS da verificação dos
   * documentos, por isso quem está travado neles tem os documentos validados.
   * É a única dedução segura, e é por isso que é a única que se faz.
   */
  it("sem o campo, quem está travado no IBAN já passou os documentos", async () => {
    const semCampo = { ...completo({ id: 1, account_blocker: "iban_missing", can_accept_service: false }) };
    delete (semCampo as Record<string, unknown>).all_documents_verified;

    const { contagem } = await correr([[semCampo]]);

    expect(contagem.perfilCompleto).toBe(1);
    expect(contagem.contactoPorVerificar).toBe(0);
  });
});

describe("funil dos técnicos — a lista inteira", () => {
  /**
   * O controlador do Laravel trava o `per_page` em 100 e não se queixa. Pedir
   * 1000 e acreditar na resposta dava uma conta sobre os primeiros 100.
   */
  it("percorre todas as páginas em vez de contar só a primeira", async () => {
    const pagina = (ids: number[]) => ids.map((id) => completo({ id }));
    const { contagem } = await correr([
      pagina([1, 2, 3]),
      pagina([4, 5, 6]),
      pagina([7]),
    ]);

    expect(contagem.total).toBe(7);
    expect(pedidos).toHaveLength(3);
    expect(pedidos[0]).toContain("per_page=100");
    expect(pedidos.map((p) => new URL(`http://x${p}`).searchParams.get("page"))).toEqual(["1", "2", "3"]);
  });

  it("uma lista vazia dá zeros, e não um erro", async () => {
    const { contagem, items } = await correr([[]]);

    expect(contagem.total).toBe(0);
    expect(contagem.perfilCompleto).toBe(0);
    expect(items).toEqual([]);
  });
});
