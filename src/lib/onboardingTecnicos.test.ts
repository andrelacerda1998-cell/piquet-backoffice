import { describe, it, expect } from "vitest";
import { construirFunil, diasDesde, etapaDe, ETAPAS } from "./onboardingTecnicos";

const HOJE = new Date("2026-09-28T12:00:00Z");

const tecnico = (over: Record<string, unknown> = {}) => ({
  id: 1, name: "Ana", phone_number: "912345678",
  account_blocker: null as string | null, created_at: "2026-09-01T00:00:00Z",
  operation_areas: [], suspended_at: null as string | null,
  ...over,
});

describe("etapaDe", () => {
  it("reconhece os quatro códigos do Laravel", () => {
    for (const e of ETAPAS) expect(etapaDe(e)).toBe(e);
  });

  it("null quer dizer pronto", () => {
    expect(etapaDe(null)).toBeNull();
  });

  it("um código que não conhecemos não vira etapa inventada", () => {
    // Se o backend acrescentar um código novo, é melhor contá-lo como pronto
    // do que criar uma etapa fantasma no funil.
    expect(etapaDe("qualquer_coisa_nova")).toBeNull();
  });
});

describe("diasDesde", () => {
  it("conta dias inteiros, não horas", () => {
    expect(diasDesde("2026-09-01T23:00:00Z", HOJE)).toBe(27);
  });

  it("hoje é zero dias", () => {
    expect(diasDesde("2026-09-28T01:00:00Z", HOJE)).toBe(0);
  });

  it("sem data não inventa zero", () => {
    expect(diasDesde(null, HOJE)).toBeNull();
    expect(diasDesde("nem é uma data", HOJE)).toBeNull();
  });

  it("uma data no futuro não dá dias negativos", () => {
    expect(diasDesde("2026-10-10T00:00:00Z", HOJE)).toBe(0);
  });
});

describe("construirFunil", () => {
  it("conta cada etapa e quem está pronto", () => {
    const f = construirFunil([
      tecnico({ id: 1, account_blocker: "contact_unverified" }),
      tecnico({ id: 2, account_blocker: "contact_unverified" }),
      tecnico({ id: 3, account_blocker: "iban_missing" }),
      tecnico({ id: 4, account_blocker: null }),
    ], HOJE);

    expect(f.total).toBe(4);
    expect(f.prontos).toBe(1);
    expect(f.porEtapa.contact_unverified).toBe(2);
    expect(f.porEtapa.iban_missing).toBe(1);
    // As quatro chaves existem sempre: zero é uma resposta, não um buraco.
    expect(f.porEtapa.documents_pending).toBe(0);
    expect(f.porEtapa.fiscal_address_missing).toBe(0);
  });

  it("não conta suspensos — esses não estão a meio de nada", () => {
    const f = construirFunil([
      tecnico({ id: 1, account_blocker: "iban_missing" }),
      tecnico({ id: 2, account_blocker: "iban_missing", suspended_at: "2026-08-01T00:00:00Z" }),
    ], HOJE);

    expect(f.total).toBe(1);
    expect(f.porEtapa.iban_missing).toBe(1);
    expect(f.parados).toHaveLength(1);
  });

  it("separa o que espera por nós do que espera pelo técnico", () => {
    const f = construirFunil([
      tecnico({ id: 1, account_blocker: "documents_pending" }),
      tecnico({ id: 2, account_blocker: "documents_pending" }),
      tecnico({ id: 3, account_blocker: "iban_missing" }),
      tecnico({ id: 4, account_blocker: "contact_unverified" }),
    ], HOJE);

    // Só os documentos dependem da Piquet: o IBAN e o contacto só o técnico
    // os pode preencher.
    expect(f.aEsperaDeNos).toBe(2);
  });

  it("põe quem espera há mais tempo em primeiro", () => {
    const f = construirFunil([
      tecnico({ id: 1, account_blocker: "iban_missing", created_at: "2026-09-20T00:00:00Z" }),
      tecnico({ id: 2, account_blocker: "iban_missing", created_at: "2026-06-01T00:00:00Z" }),
      tecnico({ id: 3, account_blocker: "iban_missing", created_at: "2026-09-27T00:00:00Z" }),
    ], HOJE);

    expect(f.parados.map((p) => p.id)).toEqual([2, 1, 3]);
    expect(f.parados[0].diasParado).toBe(119);
  });

  it("quem não tem data vai para o fim, não para o topo", () => {
    const f = construirFunil([
      tecnico({ id: 1, account_blocker: "iban_missing", created_at: null }),
      tecnico({ id: 2, account_blocker: "iban_missing", created_at: "2026-09-20T00:00:00Z" }),
    ], HOJE);

    expect(f.parados.map((p) => p.id)).toEqual([2, 1]);
    expect(f.parados[1].diasParado).toBeNull();
  });

  it("os prontos não entram na lista dos parados", () => {
    const f = construirFunil([tecnico({ id: 1, account_blocker: null })], HOJE);
    expect(f.parados).toHaveLength(0);
    expect(f.prontos).toBe(1);
  });

  it("corta a lista no limite pedido mas não as contagens", () => {
    const muitos = Array.from({ length: 40 }, (_, i) =>
      tecnico({ id: i + 1, account_blocker: "iban_missing" }));
    const f = construirFunil(muitos, HOJE, 10);

    expect(f.porEtapa.iban_missing).toBe(40);
    expect(f.parados).toHaveLength(10);
  });

  it("sem ninguém devolve zeros e não rebenta", () => {
    const f = construirFunil([], HOJE);
    expect(f.total).toBe(0);
    expect(f.prontos).toBe(0);
    expect(f.aEsperaDeNos).toBe(0);
    expect(f.parados).toEqual([]);
  });

  it("aguenta um técnico sem nome e sem categorias", () => {
    const f = construirFunil([
      { id: 9, account_blocker: "iban_missing" },
    ], HOJE);
    expect(f.parados[0].nome).toBe("Técnico #9");
    expect(f.parados[0].categorias).toEqual([]);
  });
});
