import { describe, it, expect, vi, afterEach } from "vitest";
import { isLiveEndpoint } from "@/services/api";

describe("isLiveEndpoint — allowlist da migração incremental", () => {
  it("marca como migrados os endpoints da Fase 1 (Serviços)", () => {
    expect(isLiveEndpoint("/services")).toBe(true);
    expect(isLiveEndpoint("/services?page=2&status=concluido")).toBe(true);
    expect(isLiveEndpoint("/services/srv_123")).toBe(true);
    expect(isLiveEndpoint("/dashboard/recent-services")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 2 (Clientes & Técnicos)", () => {
    expect(isLiveEndpoint("/customers")).toBe(true);
    expect(isLiveEndpoint("/customers/metrics")).toBe(true);
    expect(isLiveEndpoint("/customers/by-source")).toBe(true);
    expect(isLiveEndpoint("/technicians?page=1")).toBe(true);
    expect(isLiveEndpoint("/technicians/coverage")).toBe(true);
    expect(isLiveEndpoint("/technicians/top")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 3a (Financeiro derivável)", () => {
    expect(isLiveEndpoint("/finance/by-service?page=1")).toBe(true);
    expect(isLiveEndpoint("/finance/daily-revenue")).toBe(true);
    expect(isLiveEndpoint("/finance/revenue-by-technician")).toBe(true);
    expect(isLiveEndpoint("/finance/revenue-vs-costs")).toBe(true);
    expect(isLiveEndpoint("/dashboard/revenue-by-category")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 4 (Impostos e RH + Marketing)", () => {
    expect(isLiveEndpoint("/employees?page=1")).toBe(true);
    expect(isLiveEndpoint("/employees/dashboard")).toBe(true);
    expect(isLiveEndpoint("/employees/internal-vs-contractors")).toBe(true);
    expect(isLiveEndpoint("/finance/summary")).toBe(true); // desbloqueado por employees
    expect(isLiveEndpoint("/finance/operational-result")).toBe(true);
    expect(isLiveEndpoint("/marketing/metrics")).toBe(true);
    expect(isLiveEndpoint("/marketing/channels")).toBe(true);
    expect(isLiveEndpoint("/marketing/creatives")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 5 (Equipa)", () => {
    expect(isLiveEndpoint("/team/messages")).toBe(true);
    expect(isLiveEndpoint("/team/agenda")).toBe(true);
    expect(isLiveEndpoint("/team/meetings")).toBe(true);
    expect(isLiveEndpoint("/team/tasks")).toBe(true);
    expect(isLiveEndpoint("/team/tasks/task_1/status")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 6 (Impostos)", () => {
    expect(isLiveEndpoint("/tax/obligations")).toBe(true);
    expect(isLiveEndpoint("/tax/obligations?status=pendente")).toBe(true);
    expect(isLiveEndpoint("/tax/summary")).toBe(true);
    expect(isLiveEndpoint("/tax/obligations/tax_001/pay")).toBe(true); // marcar paga
    expect(isLiveEndpoint("/tax/budget")).toBe(false); // sintético → mock
  });

  it("marca como migrados os endpoints da Fase 7 (Pagamentos a técnicos)", () => {
    expect(isLiveEndpoint("/finance/payouts")).toBe(true);
    expect(isLiveEndpoint("/finance/payouts/payout_1/process")).toBe(true);
    expect(isLiveEndpoint("/finance/pending-payments")).toBe(false); // sintético
    expect(isLiveEndpoint("/finance/refunds")).toBe(false); // sintético
  });

  it("mantém mock os endpoints ainda não migrados", () => {
    expect(isLiveEndpoint("/services/operational-metrics")).toBe(false); // partilha prefixo mas não migrado
    expect(isLiveEndpoint("/technicians/pending")).toBe(false); // KYC ainda não modelado
    expect(isLiveEndpoint("/customers/retention")).toBe(false); // sintético
    expect(isLiveEndpoint("/customers/trend")).toBe(false); // sintético
    expect(isLiveEndpoint("/finance/invoices")).toBe(false); // precisa faturação certificada
    expect(isLiveEndpoint("/finance/pending-payments")).toBe(false); // sintético
    expect(isLiveEndpoint("/marketing/funnel")).toBe(false); // sintético
    expect(isLiveEndpoint("/employees/simulate")).toBe(false); // cálculo puro, sem BD
    expect(isLiveEndpoint("/dashboard/overview")).toBe(false);
  });
});

describe("isDemoEndpoint — o que é FICÇÃO (≠ o que está ligado à BD)", () => {
  // `isDemoEndpoint` só distingue quando há backend configurado; sem ele, é
  // tudo demo. Daí carregar o módulo de novo com a env definida.
  async function load() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://exemplo.test/api");
    return import("@/services/api");
  }
  afterEach(() => vi.unstubAllEnvs());

  it("trata como REAIS só os endpoints alimentados por APIs externas ou uso humano", async () => {
    const { isDemoEndpoint } = await load();
    expect(isDemoEndpoint("/marketing/campaigns")).toBe(false); // Meta Ads
    expect(isDemoEndpoint("/marketing/metrics")).toBe(false);
    expect(isDemoEndpoint("/finance/app-payments")).toBe(false); // Payshop
    expect(isDemoEndpoint("/product/growth")).toBe(false); // downloads das lojas
    expect(isDemoEndpoint("/product/ratings")).toBe(false); // avaliações nas lojas
    expect(isDemoEndpoint("/dev-tasks")).toBe(false); // escrito pela equipa
    expect(isDemoEndpoint("/dev-tasks/task_1")).toBe(false);
    // Equipa: seed apagado da BD a 2026-07-16 — só resta conteúdo humano.
    expect(isDemoEndpoint("/team/messages")).toBe(false);
    expect(isDemoEndpoint("/team/tasks")).toBe(false);
    expect(isDemoEndpoint("/team/tasks/tt1/status")).toBe(false);
  });

  it("trata como DEMO o que vem da BD mas foi escrito pelo seed", async () => {
    const { isDemoEndpoint, isLiveEndpoint } = await load();
    // Estes vão ao backend real E MESMO ASSIM são ficção: as tabelas foram
    // preenchidas de uma vez pelo seed. (/services saiu desta lista a
    // 2026-07-17: o seed foi apagado e a tabela só tem serviços concluídos
    // registados à mão — dados reais.)
    for (const ep of ["/customers", "/technicians", "/employees",
                      "/finance/summary", "/tax/obligations", "/finance/payouts"]) {
      expect(isLiveEndpoint(ep), `${ep} devia ir ao backend`).toBe(true);
      expect(isDemoEndpoint(ep), `${ep} vem do seed → é demo`).toBe(true);
    }
  });

  it("todo o endpoint REAL tem de estar migrado — senão o mock passa por real", async () => {
    const { isDemoEndpoint, isLiveEndpoint } = await load();
    // Invariante: REAL_DATA ⊆ LIVE_EXACT. Um endpoint marcado real mas não
    // migrado corre o fetcher mock SEM selo e SEM zeragem — mentira perfeita.
    // (Aconteceu com /product/ratings: mostrou avaliações inventadas como
    // reais até este teste existir.)
    for (const ep of ["/services", "/goals", "/finance/company-invoices", "/finance/gmv",
                      "/marketing/campaigns", "/marketing/metrics",
                      "/marketing/channels", "/marketing/creatives", "/marketing/leads",
                      "/finance/app-payments", "/product/growth", "/product/ratings",
                      "/product/integrations-status", "/dev-tasks", "/team/messages",
                      "/team/tasks", "/team/agenda", "/team/meetings"]) {
      expect(isDemoEndpoint(ep), `${ep} devia ser REAL`).toBe(false);
      expect(isLiveEndpoint(ep), `${ep} é REAL_DATA mas não está em LIVE_EXACT`).toBe(true);
    }
  });

  it("deepZero: números a 0, listas vazias, rótulos intactos", async () => {
    const { deepZero } = await load();
    expect(deepZero(83417.45)).toBe(0);
    expect(deepZero([1, 2, 3])).toEqual([]);
    expect(deepZero({ gmv: 83417, label: "GMV", ativo: true, series: [{ v: 1 }], nested: { n: 7 } }))
      .toEqual({ gmv: 0, label: "GMV", ativo: true, series: [], nested: { n: 0 } });
    expect(deepZero(null)).toBeNull();
  });

  it("zero em vez de ficção: GET a endpoint demo devolve o mock zerado", async () => {
    const { apiGet } = await load();
    // /quality é demo e não-migrado → corre o fetcher mock e zera o resultado.
    const res = await apiGet("/quality", () => ({ nps: 62, complaints: [{ id: "c1" }], meta: "Qualidade" }));
    expect(res.data).toEqual({ nps: 0, complaints: [], meta: "Qualidade" });
  });

  it("sem backend configurado, o modo demo continua a mostrar os mocks", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { apiGet } = await import("@/services/api");
    const res = await apiGet("/quality", () => ({ nps: 62 }));
    expect(res.data).toEqual({ nps: 62 });
  });

  it("trata como demo tudo o que não foi confirmado como real", async () => {
    const { isDemoEndpoint } = await load();
    expect(isDemoEndpoint("/dashboard/overview")).toBe(true); // o GMV calibrado
    expect(isDemoEndpoint("/quality")).toBe(true);
    expect(isDemoEndpoint("/endpoint/que/nao/existe")).toBe(true); // por defeito, demo
  });
});
