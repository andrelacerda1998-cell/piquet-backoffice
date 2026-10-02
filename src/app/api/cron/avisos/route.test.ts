/**
 * @vitest-environment node
 *
 * O QUE CHEGA AO TELEMÓVEL, e em que circunstâncias NÃO chega.
 *
 * As regras de cada aviso vivem em `lib/avisosOperacao` e `lib/avisosPendentes`
 * e têm testes lá. O que não tinha teste nenhum eram as 500 linhas que decidem
 * se se avisa de todo: a chave, as horas, as chaves VAPID, a memória do que já
 * foi dito e o exemplo. São essas que calam — ou acordam — quem gere a Piquet.
 *
 * Os cenários estão escritos pelo que o utilizador sente: «vibrou às 3 da
 * manhã», «avisou-me do mesmo ticket seis vezes», «pedi um exemplo e deixei de
 * receber os verdadeiros».
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const tabelas: Record<string, unknown[]> = {};
const estado = {
  memoria: [] as string[],
  gravado: null as null | string[],
  avisado: null as null | { titulo: string; corpo: string; url?: string; tag?: string },
  registos: [] as { ok: boolean; nota: string }[],
};

function construtor(nome: string) {
  const resultado = { data: tabelas[nome] ?? [], error: null };
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "or", "gte", "lte", "order", "limit"]) b[m] = () => b;
  b.maybeSingle = async () =>
    nome === "app_state" ? { data: { valor: estado.memoria }, error: null } : { data: null, error: null };
  b.upsert = async (valores: { valor: string[] }) => {
    if (nome === "app_state") estado.gravado = valores.valor;
    return { error: null };
  };
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(res, rej);
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  SUPABASE_ENABLED: true,
  supabaseAdmin: () => ({ from: (t: string) => construtor(t) }),
}));

vi.mock("@/lib/push", () => ({
  PUSH_CONFIGURADO: true,
  avisar: vi.fn(async (a: { titulo: string; corpo: string }) => {
    estado.avisado = a;
    return { enviados: 2, erros: [] as string[] };
  }),
}));

vi.mock("../../_lib/cronlog", () => ({
  logCronRun: vi.fn(async (_n: string, ok: boolean, nota: string) => {
    estado.registos.push({ ok, nota });
  }),
}));

// Desligado: os serviços, documentos e workspaces do Laravel têm as regras (e
// os testes) em lib/avisosOperacao. Aqui o que se testa são os portões.
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: false,
  laravelAdminRequest: vi.fn(),
}));

import { GET } from "./route";

const SEGREDO = "um-segredo-de-cron-suficientemente-longo";

const correr = (query = "") =>
  GET(new Request(`http://x/api/cron/avisos${query}`, {
    headers: { authorization: `Bearer ${SEGREDO}` },
  }));

/** 11h em Lisboa — dentro da janela de avisos. */
const DE_DIA = new Date("2026-10-01T10:00:00Z");
/** 2h em Lisboa — fora. */
const DE_NOITE = new Date("2026-10-01T01:00:00Z");

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SEGREDO);
  for (const k of Object.keys(tabelas)) delete tabelas[k];
  estado.memoria = [];
  estado.gravado = null;
  estado.avisado = null;
  estado.registos = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(DE_DIA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const ticket = (extra: Record<string, string> = {}) => ({
  id: "TK-1", subject: "Não consigo faturar", requester_name: "Rui",
  requester_type: "tecnico", status: "novo", ...extra,
});

describe("quem pode disparar isto", () => {
  it("sem chave não avisa ninguém", async () => {
    const res = await GET(new Request("http://x/api/cron/avisos"));

    expect(res.status).toBe(401);
    expect(estado.avisado).toBeNull();
  });

  it("com a chave errada também não", async () => {
    const res = await GET(new Request("http://x/api/cron/avisos", {
      headers: { authorization: "Bearer quase-mas-nao" },
    }));

    expect(res.status).toBe(401);
    expect(estado.avisado).toBeNull();
  });
});

describe("quando é que NÃO se avisa", () => {
  /**
   * «Um telemóvel a vibrar às 3 da manhã por causa de um ticket não resolve o
   * ticket e ensina a pessoa a desligar isto.»
   */
  it("de madrugada não vibra, por muito que haja para dizer", async () => {
    vi.setSystemTime(DE_NOITE);
    tabelas.support_tickets = [ticket()];

    const res = await correr();

    expect(await res.json()).toEqual({ ok: true, nota: "fora de horas" });
    expect(estado.avisado).toBeNull();
  });

  /**
   * E, mais importante do que não avisar: não pode MARCAR como avisado. Se
   * gravasse a memória de madrugada, de manhã o ticket já era «velho» e
   * ninguém chegava a saber dele.
   */
  it("fora de horas não dá o pendente por avisado", async () => {
    vi.setSystemTime(DE_NOITE);
    tabelas.support_tickets = [ticket()];

    await correr();

    expect(estado.gravado).toBeNull();
  });

  it("sem chaves de push diz que está desligado em vez de falhar", async () => {
    vi.resetModules();
    vi.doMock("@/lib/push", () => ({ PUSH_CONFIGURADO: false, avisar: vi.fn() }));
    const { GET: semPush } = await import("./route");

    const res = await semPush(new Request("http://x/api/cron/avisos", {
      headers: { authorization: `Bearer ${SEGREDO}` },
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, nota: "sem chaves VAPID" });
    vi.doUnmock("@/lib/push");
    vi.resetModules();
  });
});

describe("de onde vem o ticket, por palavras", () => {
  it("um ticket de técnico diz técnico", async () => {
    tabelas.support_tickets = [ticket({ requester_type: "tecnico" })];

    await correr();

    expect(estado.avisado!.titulo).toContain("Ticket de técnico");
  });

  it("um ticket de cliente diz cliente", async () => {
    tabelas.support_tickets = [ticket({ requester_type: "cliente", requester_name: "Ana" })];

    await correr();

    expect(estado.avisado!.titulo).toContain("Ticket de cliente");
  });

  it("o corpo leva quem escreveu e sobre o quê", async () => {
    tabelas.support_tickets = [ticket({ requester_name: "Rui", subject: "Não consigo faturar" })];

    await correr();

    expect(estado.avisado!.corpo).toContain("Rui");
    expect(estado.avisado!.corpo).toContain("Não consigo faturar");
  });

  it("sem nome e sem assunto, ainda se percebe que há um ticket", async () => {
    tabelas.support_tickets = [ticket({ requester_name: "", subject: "" })];

    await correr();

    expect(estado.avisado!.corpo).toContain("Alguém");
    expect(estado.avisado!.corpo).toContain("(sem assunto)");
  });

  /** «em_curso» já teve resposta: avisar outra vez é ruído. */
  it("um ticket que já está a ser tratado não volta a avisar", async () => {
    tabelas.support_tickets = [ticket({ id: "TK-2", status: "em_curso" })];

    const res = await correr();

    expect(estado.avisado).toBeNull();
    expect((await res.json()).pendentes).toBe(0);
  });
});

describe("a memória do que já foi dito", () => {
  it("o mesmo ticket não avisa duas vezes", async () => {
    tabelas.support_tickets = [ticket()];

    await correr();
    expect(estado.avisado).not.toBeNull();

    estado.memoria = estado.gravado ?? [];
    estado.avisado = null;
    const segunda = await correr();

    expect(estado.avisado).toBeNull();
    expect((await segunda.json()).novos).toBe(0);
  });

  it("um ticket novo ao lado de um já avisado avisa só do novo", async () => {
    estado.memoria = ["ticket:TK-1"];
    tabelas.support_tickets = [ticket(), ticket({ id: "TK-2", requester_type: "cliente", subject: "Reembolso" })];

    await correr();

    expect(estado.avisado!.corpo).toContain("Reembolso");
    expect(estado.avisado!.corpo).not.toContain("Não consigo faturar");
  });

  /**
   * A memória grava-se SEMPRE, mesmo sem nada novo: é assim que o que foi
   * resolvido sai da lista e volta a avisar se reaparecer.
   */
  it("o que foi resolvido sai da memória", async () => {
    estado.memoria = ["ticket:TK-1", "ticket:TK-ANTIGO"];
    tabelas.support_tickets = [ticket()];

    await correr();

    expect(estado.gravado).toEqual(["ticket:TK-1"]);
  });

  it("sem nada pendente, grava uma memória vazia e não avisa", async () => {
    estado.memoria = ["ticket:TK-ANTIGO"];

    const res = await correr();

    expect(estado.avisado).toBeNull();
    expect(estado.gravado).toEqual([]);
    expect((await res.json()).novos).toBe(0);
  });
});

describe("o aviso de exemplo", () => {
  /**
   * O exemplo serve para VER como fica no telemóvel. Se mexesse na memória,
   * pedir um exemplo apagava avisos verdadeiros que ainda não tinham saído.
   */
  it("não toca na memória do que está por avisar", async () => {
    tabelas.support_tickets = [ticket()];

    const res = await correr("?exemplo=1");

    expect(res.status).toBe(200);
    expect(estado.gravado).toBeNull();
  });

  it("vai à frente da janela de horas, porque quem pede quer ver agora", async () => {
    vi.setSystemTime(DE_NOITE);
    tabelas.support_tickets = [ticket()];

    const res = await correr("?exemplo=1");

    expect((await res.json()).ok).toBe(true);
    expect(estado.avisado).not.toBeNull();
  });

  it("diz «exemplo» no corpo para não se confundir com um aviso a sério", async () => {
    tabelas.support_tickets = [ticket()];

    await correr("?exemplo=1");

    expect(estado.avisado!.corpo).toContain("exemplo");
  });
});

describe("o que fica no registo das corridas", () => {
  it("regista quantos foram avisados", async () => {
    tabelas.support_tickets = [ticket()];

    await correr();

    expect(estado.registos.at(-1)).toMatchObject({ ok: true });
    expect(estado.registos.at(-1)!.nota).toContain("2 dispositivos");
  });

  it("regista também quando não havia nada a dizer", async () => {
    await correr();

    expect(estado.registos.at(-1)!.nota).toContain("nada novo");
  });
});
