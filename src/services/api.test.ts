import { describe, it, expect, vi, afterEach } from "vitest";
import { isLiveEndpoint } from "@/services/api";

describe("isLiveEndpoint — allowlist da migração incremental", () => {
  it("marca como migrados os endpoints da Fase 1 (Serviços)", () => {
    expect(isLiveEndpoint("/services")).toBe(true);
    expect(isLiveEndpoint("/services?page=2&status=concluido")).toBe(true);
    expect(isLiveEndpoint("/services/srv_123")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 2 (Clientes & Técnicos)", () => {
    expect(isLiveEndpoint("/customers")).toBe(true);
    expect(isLiveEndpoint("/customers/metrics")).toBe(true);
    expect(isLiveEndpoint("/customers/by-location")).toBe(true);
    expect(isLiveEndpoint("/customers/trend")).toBe(true);
    expect(isLiveEndpoint("/customers/retention")).toBe(true);
    expect(isLiveEndpoint("/customers/123/block")).toBe(true);
    expect(isLiveEndpoint("/customers/123/restore")).toBe(true);
    expect(isLiveEndpoint("/technicians?page=1")).toBe(true);
    expect(isLiveEndpoint("/technicians/coverage")).toBe(true);
    expect(isLiveEndpoint("/technicians/top")).toBe(true);
    expect(isLiveEndpoint("/technicians/live-locations")).toBe(true);
  });

  /*
    Os dois botões da ficha do técnico. Estavam fora da allowlist e por isso o
    pedido nunca saía do browser: caía no ramo de demonstração, que lança
    "precisa da API de admin do Laravel configurada" -- uma mensagem que
    culpava a configuração do servidor, estando ela certa.
  */
  it("marca como reais as ações da ficha do técnico (AT e faturação)", () => {
    expect(isLiveEndpoint("/technicians/123/at-validation")).toBe(true);
    expect(isLiveEndpoint("/technicians/123/invoice-workspace")).toBe(true);
    expect(isLiveEndpoint("/technicians/123/permanent")).toBe(true);
    expect(isLiveEndpoint("/technicians/123/suspend")).toBe(true);
    expect(isLiveEndpoint("/technicians/123/restore")).toBe(true);
    // Um subcaminho inventado continua fora: a regra é estreita de propósito.
    expect(isLiveEndpoint("/technicians/123/qualquer-coisa")).toBe(false);
  });

  it("marca como migrados os endpoints da Fase 3a (Financeiro derivável)", () => {
    expect(isLiveEndpoint("/finance/revenue-vs-costs")).toBe(true);
  });

  it("marca como migrados os endpoints da Fase 4 (Impostos e RH + Marketing)", () => {
    expect(isLiveEndpoint("/employees?page=1")).toBe(true);
    expect(isLiveEndpoint("/employees/dashboard")).toBe(true);
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
    expect(isLiveEndpoint("/vendor-payments")).toBe(true);
    expect(isLiveEndpoint("/vendor-payments/7/pay")).toBe(false); // saiu: só por lote
    expect(isLiveEndpoint("/finance/payout-lotes/ab-12/aprovar")).toBe(true);
    expect(isLiveEndpoint("/finance/pending-payments")).toBe(false); // sintético
    expect(isLiveEndpoint("/finance/refunds")).toBe(false); // sintético
  });

  it("marca como migrados os endpoints da Fase 11 (Catálogo + Categorias)", () => {
    expect(isLiveEndpoint("/services-types")).toBe(true);
    expect(isLiveEndpoint("/services-types?search=torneira")).toBe(true);
    expect(isLiveEndpoint("/services-types/12")).toBe(true); // editar
    expect(isLiveEndpoint("/operation-areas")).toBe(true);
    expect(isLiveEndpoint("/operation-areas/3")).toBe(true); // editar
  });

  it("marca como migrados os endpoints da Fase 12 (Zonas)", () => {
    expect(isLiveEndpoint("/allowed-zones")).toBe(true);
    expect(isLiveEndpoint("/allowed-zones?search=lisboa")).toBe(true);
    expect(isLiveEndpoint("/allowed-zones/7")).toBe(true); // editar
  });

  it("marca como migrados os endpoints da Fase 13 (Documentos + Atividade)", () => {
    expect(isLiveEndpoint("/documents")).toBe(true);
    expect(isLiveEndpoint("/documents?search=cidadao")).toBe(true);
    expect(isLiveEndpoint("/documents/4")).toBe(true); // editar
    expect(isLiveEndpoint("/audits")).toBe(true);
  });

  it("marca como migrado o endpoint de Fase 14 (Sent Notifications)", () => {
    expect(isLiveEndpoint("/sent-notifications")).toBe(true);
    expect(isLiveEndpoint("/sent-notifications?read=unread")).toBe(true);
    expect(isLiveEndpoint("/sent-notifications/types")).toBe(true);
  });

  it("marca como migrados os endpoints de Fase 15 (Métodos de pagamento do cliente)", () => {
    expect(isLiveEndpoint("/customers/42/payment-methods")).toBe(true);
    expect(isLiveEndpoint("/customers/42/payment-methods/7")).toBe(true); // apagar
  });

  it("marca como migrado o endpoint de Fase 16 (Códigos SMS)", () => {
    expect(isLiveEndpoint("/sms-codes")).toBe(true);
    expect(isLiveEndpoint("/sms-codes?type=login")).toBe(true);
  });

  it("marca como migrado o endpoint de Fase 17 (Cobertura por técnico)", () => {
    expect(isLiveEndpoint("/coverage")).toBe(true);
  });

  it("marca como migrado o endpoint de editar um lead (valor estimado/fase)", () => {
    expect(isLiveEndpoint("/marketing/leads/abc-123")).toBe(true);
  });

  it("mantém mock os endpoints ainda não migrados", () => {
    expect(isLiveEndpoint("/services/operational-metrics")).toBe(false); // partilha prefixo mas não migrado
    expect(isLiveEndpoint("/technicians/pending")).toBe(false); // KYC ainda não modelado
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
    expect(isDemoEndpoint("/customers/42/payment-methods")).toBe(false); // payshop_payment_methods
  });

  it("trata como DEMO o que vem da BD mas foi escrito pelo seed", async () => {
    const { isDemoEndpoint, isLiveEndpoint } = await load();
    // Estes vão ao backend real E MESMO ASSIM são ficção: as tabelas foram
    // preenchidas de uma vez pelo seed. (/services saiu desta lista a
    // 2026-07-17, /customers+/technicians a 2026-07-20 e /employees a
    // 2026-07-22: o seed foi apagado e passam a ser dados reais ou vazios.)
    // (/finance/payouts foi retirado a 2026-08-11: a página Relatórios passou
    // a usar o saldo real do /vendor-payments, ledger Laravel.)
    // (/tax/obligations e /finance/summary saíram a 2026-09-22, pela MESMA
    // regra das anteriores: as 27 obrigações semeadas foram apagadas e o
    // resumo passou a somar os serviços do Laravel. Ficar na lista fazia o
    // selo dizer "dados fictícios" por cima de números verdadeiros.)
    for (const ep of ["/tax/summary", "/tax/vat"]) {
      expect(isLiveEndpoint(ep), `${ep} devia ir ao backend`).toBe(true);
      expect(isDemoEndpoint(ep), `${ep} vem do seed → é demo`).toBe(true);
    }
  });

  /*
    A mesma tabela não pode ter selos diferentes conforme o ecrã. Os gráficos
    do Financeiro derivam de `services`, que é real desde que o seed foi
    apagado -- durante um tempo a lista era real e o gráfico feito a partir
    dela dizia "demo".
  */
  it("o que deixou de vir do seed deixa de ter selo de demonstração", async () => {
    const { isDemoEndpoint } = await load();
    expect(isDemoEndpoint("/tax/obligations")).toBe(false);
    expect(isDemoEndpoint("/finance/summary")).toBe(false);
  });

  it("um gráfico derivado de dados reais também é real", async () => {
    const { isDemoEndpoint } = await load();
    for (const ep of [
      "/finance/revenue-vs-costs", "/finance/operational-result",
    ]) {
      expect(isDemoEndpoint(ep), `${ep} deriva de /services, que é real`).toBe(false);
    }
  });

  it("todo o endpoint REAL tem de estar migrado — senão o mock passa por real", async () => {
    const { isDemoEndpoint, isLiveEndpoint } = await load();
    // Invariante: REAL_DATA ⊆ LIVE_EXACT. Um endpoint marcado real mas não
    // migrado corre o fetcher mock SEM selo e SEM zeragem — mentira perfeita.
    // (Aconteceu com /product/ratings: mostrou avaliações inventadas como
    // reais até este teste existir.)
    for (const ep of ["/services", "/customers", "/customers/metrics",
                      "/technicians", "/technicians/metrics", "/technicians/coverage",
                      "/goals", "/finance/company-invoices", "/finance/gmv", "/finance/unit-economics",
                      "/marketing/campaigns", "/marketing/metrics",
                      "/marketing/channels", "/marketing/creatives", "/marketing/leads",
                      "/finance/app-payments", "/product/growth", "/product/ratings",
                      "/product/integrations-status", "/product/funnel", "/dev-tasks", "/tasks",
                      "/team/messages", "/team/tasks", "/team/agenda", "/team/meetings", "/team/channels",
                      "/finance/budget", "/employees", "/employees/dashboard",
                      "/customers", "/customers/metrics", "/customers/by-location",
                      "/customers/trend", "/customers/retention", "/technicians",
                      "/technicians/metrics", "/technicians/by-category", "/technicians/by-location",
                      "/technicians/top", "/technicians/coverage", "/technicians/live-locations",
                      "/services-types", "/operation-areas", "/allowed-zones",
                      "/documents", "/audits", "/sent-notifications", "/sent-notifications/types",
                      "/sms-codes", "/coverage", "/vendor-payments"]) {
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
    /*
      /product/bugs é demo e não-migrado → corre o fetcher mock e zera o
      resultado. Era /quality até 28/09/2026, quando as avaliações passaram a
      vir dos serviços do Laravel (services.rating_by_customer) e o endpoint
      deixou esta lista — como está previsto acontecer a cada um destes à
      medida que ganham fonte real.
    */
    const res = await apiGet("/product/bugs", () => ({ abertos: 62, itens: [{ id: "b1" }], meta: "Bugs" }));
    expect(res.data).toEqual({ abertos: 0, itens: [], meta: "Bugs" });
  });

  it("sem backend configurado, o modo demo continua a mostrar os mocks", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { apiGet } = await import("@/services/api");
    const res = await apiGet("/product/bugs", () => ({ abertos: 62 }));
    expect(res.data).toEqual({ abertos: 62 });
  });

  it("trata como demo tudo o que não foi confirmado como real", async () => {
    const { isDemoEndpoint } = await load();
    expect(isDemoEndpoint("/dashboard/overview")).toBe(true); // o GMV calibrado
    expect(isDemoEndpoint("/product/bugs")).toBe(true);
    // E o contrário, para esta rede apanhar o dia em que alguém ligar um
    // endpoint real e se esquecer de o tirar da lista de ficção:
    expect(isDemoEndpoint("/quality")).toBe(false);

    /*
      Estar em LIVE_EXACT não chega: essa lista só diz "vai buscar à API a
      sério". É REAL_DATA que diz "estes números são verdadeiros, não os
      zeres". O custo por instalação foi para a primeira e não para a
      segunda, e o deepZero punha tudo a zero à chegada -- o cartão ficava a
      "—" e o painel de cobertura desaparecia, sem erro nenhum a apontar
      para a causa.
    */
    expect(isDemoEndpoint("/product/cost-per-download")).toBe(false);

    // Mesma armadilha, segunda vez: LIVE_EXACT faz o pedido sair, REAL_DATA
    // impede o deepZero de o esvaziar à chegada. Faltar a segunda dava uma
    // lista vazia sem erro nenhum.
    expect(isDemoEndpoint("/technicians/funil")).toBe(false);
    expect(isLiveEndpoint("/technicians/funil")).toBe(true);
    expect(isDemoEndpoint("/endpoint/que/nao/existe")).toBe(true); // por defeito, demo
  });
});

/**
 * A ARMADILHA QUE JÁ APANHOU TRÊS ENDPOINTS.
 *
 * São precisas DUAS entradas por endpoint: `LIVE_EXACT` («vai ao backend») e
 * `REAL_DATA` («o que de lá vem é verdade»). Quem põe na primeira e esquece a
 * segunda não vê erro: vê o `deepZero` a pôr os números a zero, o cartão a
 * mostrar «—» e o painel a desaparecer sem uma linha de log.
 *
 * Foi assim com `/product/cost-per-download` (custo por instalação a zero), e
 * outra vez com `/technicians/funil` e `/technicians/documentos`. Três vezes é
 * padrão, não azar — e um padrão silencioso é o que um teste serve para
 * tornar barulhento.
 */
describe("LIVE_EXACT × REAL_DATA — nenhuma lista pode divergir em silêncio", () => {
  /**
   * As excepções LEGÍTIMAS: endpoints que vão ao backend e cujos dados NÃO são
   * verdadeiros, ou que não são dados de todo. Cada um com a razão à frente,
   * porque uma lista de excepções sem razões vira um sítio onde se despeja o
   * que não se percebe.
   */
  const EXCECOES: Record<string, string> = {
    "/tax/summary": "vem do seed — é ficção, e o selo de demonstração está certo",
    "/tax/vat": "idem",
    "/support/inbox/seed": "é uma ação de semear, não devolve números",
    "/technicians/test-account": "é uma ação sobre a conta de teste, não devolve números",
  };

  it("todo o endpoint ligado ao backend está classificado quanto à origem dos dados", async () => {
    const { _LISTAS } = await import("@/services/api");
    const porClassificar = [..._LISTAS.LIVE_EXACT]
      .filter((p) => !_LISTAS.REAL_DATA.has(p) && !(p in EXCECOES));

    expect(
      porClassificar,
      `Endpoint(s) em LIVE_EXACT sem entrada em REAL_DATA. Ou os dados são reais `
      + `(acrescenta a REAL_DATA) ou são ficção (acrescenta às EXCECOES deste teste, `
      + `com a razão). Sem isto, o deepZero põe os números a zero em silêncio.`,
    ).toEqual([]);
  });

  it("a lista de excepções não envelhece sozinha", async () => {
    const { _LISTAS } = await import("@/services/api");
    const chaves = Object.keys(EXCECOES);

    // Uma excepção que entretanto entrou em REAL_DATA deixou de ser excepção.
    expect(chaves.filter((p) => _LISTAS.REAL_DATA.has(p))).toEqual([]);
    // E uma que já nem vá ao backend não tem nada que fazer aqui.
    expect(chaves.filter((p) => !_LISTAS.LIVE_EXACT.has(p))).toEqual([]);
  });

  /** Os três que custaram caro, nomeados para nunca mais escorregarem. */
  it("os endpoints que já falharam estão nas duas listas", async () => {
    const { _LISTAS } = await import("@/services/api");
    for (const ep of ["/product/cost-per-download", "/technicians/funil", "/technicians/documentos"]) {
      expect(_LISTAS.LIVE_EXACT.has(ep), `${ep} tem de ir ao backend`).toBe(true);
      expect(_LISTAS.REAL_DATA.has(ep), `${ep} tem de contar como dados reais`).toBe(true);
    }
  });
});

/**
 * O BURACO DO TESTE ANTERIOR, e porque é que este lê o código em vez de listas.
 *
 * O teste acima compara `LIVE_EXACT` com `REAL_DATA`. Não via os caminhos que
 * vão ao backend por expressão regular -- e foi por aí que entraram quatro
 * leituras zeradas: os volumes da Visão Geral (`/services/counts`, apanhado
 * pelo padrão `/services/:id`), as fotos do cliente e a cronologia de um
 * pedido. Encontradas numa auditoria, não por este teste.
 *
 * Este não pergunta às listas: lê os `apiGet` que o código faz de facto em
 * src/services/, troca cada `${…}` por um id de exemplo, e verifica que nenhum
 * pedido que vai ao backend volta zerado, salvo a ficção declarada abaixo. Um
 * GET novo, por qualquer caminho, entra na verificação sem ninguém se lembrar.
 *
 * Não apanha um `apiGet(variavel)` cujo caminho não está escrito ali. Hoje não
 * há nenhum.
 */
describe("todo o GET que vai ao backend chega ao ecrã sem ser zerado", () => {
  /** Ficção declarada: vai ao backend e os números SÃO inventados, ou não é usado. */
  const FICCAO: Record<string, string> = {
    "/tax/summary": "vem do seed",
    "/tax/vat": "vem do seed",
  };

  async function load() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://exemplo.test/api");
    return import("@/services/api");
  }
  afterEach(() => vi.unstubAllEnvs());

  function getsDoCodigo(): string[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const dir = path.join(process.cwd(), "src/services");
    const caminhos = new Set<string>();
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
      const t = fs.readFileSync(path.join(dir, f), "utf8");
      for (const m of t.matchAll(/apiGet\b/g)) {
        const janela = t.slice(m.index! + 6, m.index! + 400);
        const p = janela.match(/\(\s*["`](\/[^"`]+)["`]/);
        if (!p) continue;
        caminhos.add(p[1].replace(/\$\{[^}]+\}/g, "x").split("?")[0]);
      }
    }
    return [...caminhos].sort();
  }

  it("encontra os pedidos do código (se isto falhar, o leitor partiu-se)", () => {
    const gets = getsDoCodigo();
    expect(gets.length).toBeGreaterThan(50);
    expect(gets).toContain("/services/counts");
    expect(gets).toContain("/services/x/fotos");
  });

  it("nenhum vai ao backend para depois ser zerado", async () => {
    const { isLiveEndpoint: vaiAoBackend, isDemoEndpoint: eZerado } = await load();
    const zerados = getsDoCodigo()
      .filter((p) => vaiAoBackend(p) && eZerado(p) && !(p in FICCAO));

    expect(
      zerados,
      `GET que vai ao backend e é ZERADO no browser antes de chegar ao ecrã. Se os `
      + `dados são reais, acrescenta a REAL_DATA (caminho exato) ou REAL_PATTERNS (com id). `
      + `Se são ficção, acrescenta a FICCAO neste teste, com a razão.`,
    ).toEqual([]);
  });

  it("a ficção declarada continua a existir e a ir ao backend", async () => {
    const { isLiveEndpoint: vaiAoBackend } = await load();
    const gets = new Set(getsDoCodigo());
    for (const p of Object.keys(FICCAO)) {
      expect(gets.has(p), `${p} já não é pedido por ninguém: sai da FICCAO`).toBe(true);
      expect(vaiAoBackend(p), `${p} já não vai ao backend: sai da FICCAO`).toBe(true);
    }
  });
});
