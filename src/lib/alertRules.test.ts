import { describe, it, expect } from "vitest";
import { gerarAlertas, LIMITES, quandoEmLisboa, type SinaisDoNegocio, DONOS } from "./alertRules";

const AGORA = Date.parse("2026-08-20T12:00:00Z");
const haDias = (n: number) => new Date(AGORA - n * 86_400_000).toISOString();

const vazio: SinaisDoNegocio = {
  leadsPorResponder: [], cronsFalhados: [], ticketsAbertos: [], faturasVencidas: [], impostosVencidos: [],
  documentosPendentes: 0, diasSemDadosDeAnuncios: null, pagamentosRecusados: 0,
};

describe("gerarAlertas", () => {
  it("sem problemas, não inventa alertas", () => {
    // O contrário do que fazia o mock: mostrava sempre a mesma lista fixa.
    expect(gerarAlertas(vazio, AGORA)).toEqual([]);
  });

  it("uma lead de hoje JÁ é alerta — é agora que responder ainda ganha o cliente", () => {
    const r = gerarAlertas({ ...vazio,
      leadsPorResponder: [{ id: "1", nome: "Ana", recebidaEm: haDias(0) }] }, AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].priority).toBe("alta");
    expect(r[0].title).toBe("Lead nova por responder");
  });

  it("lead por responder há 1 dia é alerta alto; há 3 dias é crítico", () => {
    const um = gerarAlertas({ ...vazio,
      leadsPorResponder: [{ id: "1", nome: "Ana", recebidaEm: haDias(1) }] }, AGORA);
    expect(um[0].priority).toBe("alta");
    expect(um[0].title).toContain("1 dia");

    const tres = gerarAlertas({ ...vazio,
      leadsPorResponder: [{ id: "1", nome: "Ana", recebidaEm: haDias(3) }] }, AGORA);
    expect(tres[0].priority).toBe("critica");
    expect(tres[0].title).toContain("3 dias");
  });

  it("cada lead gera o seu alerta, com o nome de quem espera", () => {
    const r = gerarAlertas({ ...vazio, leadsPorResponder: [
      { id: "1", nome: "Ana", recebidaEm: haDias(2) },
      { id: "2", nome: "Bruno", recebidaEm: haDias(2) },
    ] }, AGORA);
    expect(r).toHaveLength(2);
    expect(r.map((a) => a.description).join(" ")).toContain("Bruno");
  });

  it("cron só alerta a partir de 3 falhas seguidas", () => {
    const duas = gerarAlertas({ ...vazio, cronsFalhados: [
      { job: "ad-metrics", falhasSeguidas: 2, ultimoErro: "x", ultimaTentativa: haDias(0) }] }, AGORA);
    expect(duas).toHaveLength(0);

    const tres = gerarAlertas({ ...vazio, cronsFalhados: [
      { job: "ad-metrics", falhasSeguidas: LIMITES.cronFalhasSeguidas, ultimoErro: "OAuth 400", ultimaTentativa: haDias(0) }] }, AGORA);
    expect(tres).toHaveLength(1);
    expect(tres[0].description).toContain("OAuth 400");
  });

  it("um único documento de técnico já aparece; a fila grande sobe de urgência", () => {
    expect(gerarAlertas({ ...vazio, documentosPendentes: 0 }, AGORA)).toHaveLength(0);
    const um = gerarAlertas({ ...vazio, documentosPendentes: 1 }, AGORA);
    expect(um).toHaveLength(1);
    expect(um[0].priority).toBe("media");
    expect(gerarAlertas({ ...vazio, documentosPendentes: 10 }, AGORA)[0].priority).toBe("alta");
  });

  /*
    O alerta "à espera do cliente" desapareceu com o estado que o gerava:
    "Aguarda resposta" era o funil de orçamentos, e este negócio não tem esse
    passo. O que resta são todos alertas do nosso lado.
  */
  it("os alertas que restam resolvem-se todos deste lado", () => {
    const r = gerarAlertas({
      leadsPorResponder: [{ id: "1", nome: "Ana", recebidaEm: haDias(5) }],
      cronsFalhados: [], ticketsAbertos: [], documentosPendentes: 0,
      diasSemDadosDeAnuncios: null, pagamentosRecusados: 0,
      faturasVencidas: [], impostosVencidos: [],
    }, AGORA);
    expect(r.find((a) => a.entityId === "1")!.priority).toBe("critica");
  });

  it("fatura vencida é alta; aos 15 dias passa a crítica", () => {
    const f = (dias: number) => gerarAlertas({ ...vazio,
      faturasVencidas: [{ fornecedor: "CAPENSIS", valorEmDivida: 2152.5, venceuEm: haDias(dias) }] }, AGORA);
    expect(f(2)[0].priority).toBe("alta");
    expect(f(2)[0].description).toContain("2152,50 €");
    expect(f(20)[0].priority).toBe("critica");
  });

  it("imposto com prazo ultrapassado é sempre crítico e diz se é estimativa", () => {
    const r = gerarAlertas({ ...vazio,
      impostosVencidos: [{ nome: "IVA", valor: 2685.38, venceuEm: haDias(5), estimado: true }] }, AGORA);
    expect(r[0].priority).toBe("critica");
    expect(r[0].description).toContain("(estimativa)");
  });

  it("anúncios: sem histórico nenhum não alerta (é diferente de estar parado)", () => {
    expect(gerarAlertas({ ...vazio, diasSemDadosDeAnuncios: null }, AGORA)).toHaveLength(0);
    expect(gerarAlertas({ ...vazio, diasSemDadosDeAnuncios: 1 }, AGORA)).toHaveLength(0);
    expect(gerarAlertas({ ...vazio, diasSemDadosDeAnuncios: 30 }, AGORA)).toHaveLength(1);
  });

  it("ordena por urgência e, dentro dela, o mais antigo primeiro", () => {
    const r = gerarAlertas({ ...vazio,
      documentosPendentes: 5, // media
      leadsPorResponder: [
        { id: "recente", nome: "Recente", recebidaEm: haDias(4) },  // critica
        { id: "antiga", nome: "Antiga", recebidaEm: haDias(10) },   // critica
      ],
    }, AGORA);
    expect(r[0].entityId).toBe("antiga");
    expect(r[1].entityId).toBe("recente");
    expect(r[2].priority).toBe("media");
  });

  it("todo o alerta diz o que fazer a seguir", () => {
    const r = gerarAlertas({
      leadsPorResponder: [{ id: "1", nome: "Ana", recebidaEm: haDias(2) }],
      cronsFalhados: [{ job: "x", falhasSeguidas: 5, ultimoErro: "e", ultimaTentativa: haDias(0) }],
      ticketsAbertos: [{ id: "TK-1", assunto: "A", canal: "App · Cliente", desde: haDias(2) }],
      faturasVencidas: [{ fornecedor: "X", valorEmDivida: 10, venceuEm: haDias(1) }],
      impostosVencidos: [{ nome: "IVA", valor: 5, venceuEm: haDias(1), estimado: false }],
      documentosPendentes: 40, diasSemDadosDeAnuncios: 10, pagamentosRecusados: 6,
    }, AGORA);
    expect(r.length).toBe(8);
    for (const a of r) {
      expect(a.recommendedAction.length, a.title).toBeGreaterThan(10);
      expect(a.status).toBe("novo");
    }
  });

  it("ids são estáveis entre execuções (não usam a hora atual)", () => {
    const sinais = { ...vazio, leadsPorResponder: [{ id: "abc", nome: "Ana", recebidaEm: haDias(2) }] };
    const a = gerarAlertas(sinais, AGORA);
    const b = gerarAlertas(sinais, AGORA + 3_600_000);
    expect(a[0].id).toBe(b[0].id);
  });

  describe("a operação, pedido a pedido", () => {
    const pedido = { id: "318", cliente: "Marta", tipo: "Canalização", cidade: "Almada", desde: haDias(0) };

    it("um pedido crítico nas Operações ao vivo é crítico aqui, e leva ao pedido", () => {
      const [a] = gerarAlertas({ ...vazio, pedidosComAlerta: [{ ...pedido, nivel: "critico", motivo: "prazo_esgotado" }] }, AGORA);
      expect(a.priority).toBe("critica");
      expect(a.entityType).toBe("pedido");
      expect(a.entityId).toBe("318");
      expect(a.title).toContain("#318");
    });

    it("quando a bola está do lado do cliente não passa de média", () => {
      const [a] = gerarAlertas({ ...vazio, pedidosComAlerta: [{ ...pedido, nivel: "critico", motivo: "cliente_a_escolher" }] }, AGORA);
      expect(a.priority).toBe("media");
    });

    it("os 'info' não são alertas", () => {
      expect(gerarAlertas({ ...vazio, pedidosComAlerta: [{ ...pedido, nivel: "info", motivo: "prazo_a_acabar" }] }, AGORA)).toEqual([]);
    });

    it("um pedido perdido só alerta nas primeiras 24 h, e só se ainda se pode salvar", () => {
      const perdidos = [
        { ...pedido, id: "1", desfecho: "sem_resposta", criadoEm: haDias(0) },
        { ...pedido, id: "2", desfecho: "sem_resposta", criadoEm: haDias(2) },
        { ...pedido, id: "3", desfecho: "cancelado", criadoEm: haDias(0) },
        { ...pedido, id: "4", desfecho: "servido", criadoEm: haDias(0) },
      ];
      const r = gerarAlertas({ ...vazio, pedidosPerdidos: perdidos }, AGORA);
      expect(r.map((a) => a.entityId)).toEqual(["1"]);
      expect(r[0].priority).toBe("alta");
      expect(r[0].recommendedAction).toContain("Ligar ao cliente");
    });

    it("uma falta provável é crítica: há um cliente à espera", () => {
      const [a] = gerarAlertas({ ...vazio, faltasProvaveis: [{ servicoId: "309", tecnico: "Rui", cliente: "Ana", marcadoPara: haDias(0) }] }, AGORA);
      expect(a.priority).toBe("critica");
      expect(a.entityId).toBe("309");
    });

    it("um lote por aprovar sobe a alta ao fim de um dia", () => {
      const r = gerarAlertas({ ...vazio, lotesPorAprovar: [
        { id: "a", total: 120, criadoEm: haDias(0), criadoPor: "ana@piquet.pt" },
        { id: "b", total: 80, criadoEm: haDias(2), criadoPor: null },
      ] }, AGORA);
      expect(Object.fromEntries(r.map((a) => [a.entityId, a.priority]))).toEqual({ a: "media", b: "alta" });
    });
  });
});

describe("alertas com dono, lembretes e as regras da auditoria (12/10/2026)", () => {
  const AGORA = Date.parse("2026-10-12T14:00:00Z");
  const antes = (min: number) => new Date(AGORA - min * 60_000).toISOString();
  const base = {
    leadsPorResponder: [], cronsFalhados: [], ticketsAbertos: [], documentosPendentes: 0,
    faturasVencidas: [], impostosVencidos: [], diasSemDadosDeAnuncios: null, pagamentosRecusados: 0,
  };

  it("cada alerta diz quem trata dele", () => {
    const a = gerarAlertas({ ...base, leadsPorResponder: [{ id: "l1", nome: "Ana", recebidaEm: antes(5) }] }, AGORA);
    expect(a[0].donos).toEqual(DONOS.contactos);
  });

  it("faturas, impostos e anúncios são lembretes (ficam na área, não na fila)", () => {
    const a = gerarAlertas({
      ...base,
      faturasVencidas: [{ fornecedor: "EDP", valorEmDivida: 50, venceuEm: "2026-10-01" }],
      diasSemDadosDeAnuncios: 5,
    }, AGORA);
    expect(a.every((x) => x.lembrete)).toBe(true);
  });

  it("contacto urgente: alto logo, crítico ao fim de 15 minutos", () => {
    const um = (min: number) => gerarAlertas({ ...base, leadsPorResponder: [{ id: "l1", nome: "Ana", recebidaEm: antes(min), urgente: true }] }, AGORA)[0];
    expect(um(5).priority).toBe("alta");
    expect(um(20).priority).toBe("critica");
    expect(um(20).title).toContain("urgente");
  });

  it("cobrança falhada há menos de 30 minutos ainda não é alerta (quando se sabe desde quando)", () => {
    const p = (min: number | null) => gerarAlertas({ ...base, pedidosComAlerta: [{
      id: "282", cliente: "Marta", tipo: "Canalização", cidade: "Lisboa", nivel: "critico",
      motivo: "pagamento_por_capturar", desde: antes(600), estadoDesde: min === null ? null : antes(min),
    }] }, AGORA);
    expect(p(10)).toHaveLength(0);
    expect(p(45)).toHaveLength(1);
    expect(p(null)).toHaveLength(1);
    expect(p(45)[0].donos).toEqual(DONOS.cobranca);
  });

  it("ticket: o prazo depende da importância, e não conta se a última mensagem é nossa", () => {
    const t = (prioridade: string, min: number, esperaResposta = true) => gerarAlertas({ ...base, ticketsAbertos: [{
      id: "TK-1", assunto: "Cobrança", canal: "app_cliente", desde: antes(min), prioridade, esperaResposta,
    }] }, AGORA);
    expect(t("critica", 90)).toHaveLength(1);
    expect(t("critica", 30)).toHaveLength(0);
    expect(t("media", 90)).toHaveLength(0);
    expect(t("media", 60 * 25)).toHaveLength(1);
    expect(t("critica", 90, false)).toHaveLength(0);
  });

  it("reclamação aberta há mais de 24 h é alerta, mesmo já respondida", () => {
    const a = gerarAlertas({ ...base, ticketsAbertos: [{
      id: "TK-2", assunto: "Torneira a pingar", canal: "backoffice", desde: antes(30), abertoEm: antes(60 * 30),
      categoria: "Reclamação", esperaResposta: false,
    }] }, AGORA);
    expect(a.map((x) => x.id)).toEqual(["reclamacao-TK-2"]);
  });

  it("documentos: só os que esperam há mais de 24 h, quando se sabe a data", () => {
    expect(gerarAlertas({ ...base, documentosPendentes: 3, documentosAntigos: { quantos: 0, maisAntigo: null } }, AGORA)).toHaveLength(0);
    const a = gerarAlertas({ ...base, documentosPendentes: 3, documentosAntigos: { quantos: 2, maisAntigo: antes(60 * 30) } }, AGORA);
    expect(a[0].title).toContain("há mais de 24 h");
    // A bola é nossa: um técnico parado por nossa causa é "Tratar hoje", nem que seja um.
    expect(a[0].priority).toBe("alta");
  });

  it("integração do painel: atrasada ou com duas falhas seguidas", () => {
    const i = (estado: "falha" | "atrasado", falhasSeguidas: number) => gerarAlertas({ ...base, integracoes: [{
      job: "ad-metrics", nome: "Anúncios", estado, detalhe: "403", quando: antes(60 * 30), falhasSeguidas,
    }] }, AGORA);
    expect(i("falha", 1)).toHaveLength(0);
    expect(i("falha", 2)).toHaveLength(1);
    expect(i("atrasado", 0)[0].title).toContain("não corre desde");
  });

  it("cidade sem oferta e falta iminente", () => {
    const a = gerarAlertas({
      ...base,
      cidadesSemOferta: [{ cidade: "Porto", pedidos: 2 }],
      faltasIminentes: [{ servicoId: "300", tecnico: "Rui", cliente: "Ana", comecaEm: new Date(AGORA + 10 * 60_000).toISOString() }],
    }, AGORA);
    expect(a.map((x) => x.id).sort()).toEqual(["cidade-sem-oferta-porto", "falta-iminente-300"]);
  });
});

describe("a fila depois da simulação de 15/10/2026", () => {
  const AGORA = Date.parse("2026-10-15T09:00:00Z"); // 10:00 em Lisboa
  const antes = (min: number) => new Date(AGORA - min * 60_000).toISOString();
  const daqui = (min: number) => new Date(AGORA + min * 60_000).toISOString();
  const base: SinaisDoNegocio = {
    leadsPorResponder: [], cronsFalhados: [], ticketsAbertos: [], documentosPendentes: 0,
    faturasVencidas: [], impostosVencidos: [], diasSemDadosDeAnuncios: null, pagamentosRecusados: 0,
  };

  it("um serviço a começar sem o técnico ter saído é crítico e vem à frente das críticas antigas", () => {
    const r = gerarAlertas({
      ...base,
      leadsPorResponder: [{ id: "12", nome: "Condomínio", recebidaEm: antes(4 * 24 * 60) }],
      faltasIminentes: [{ servicoId: "420", tecnico: "Rui", cliente: "Ana", comecaEm: daqui(7) }],
    }, AGORA);
    expect(r[0].id).toBe("falta-iminente-420");
    expect(r[0].priority).toBe("critica");
    expect(r[0].prazo).toBe(daqui(7));
    expect(r[1].id).toBe("lead-sem-resposta-12");
  });

  it("uma falta provável (já passou da hora) vem à frente de tudo, incluindo o que está a começar", () => {
    const r = gerarAlertas({
      ...base,
      leadsPorResponder: [{ id: "12", nome: "Condomínio", recebidaEm: antes(4 * 24 * 60) }],
      faltasIminentes: [{ servicoId: "420", tecnico: "Rui", cliente: "Ana", comecaEm: daqui(7) }],
      faltasProvaveis: [{ servicoId: "405", tecnico: "Rui", cliente: "Inês", marcadoPara: antes(60) }],
    }, AGORA);
    expect(r.map((a) => a.id)).toEqual(["falta-405", "falta-iminente-420", "lead-sem-resposta-12"]);
  });

  it("entre pedidos com prazo, o mais curto primeiro", () => {
    const pedido = { cliente: "C", tipo: "Canalização", cidade: "Lisboa", nivel: "critico" as const, motivo: "prazo_a_acabar", desde: antes(5) };
    const r = gerarAlertas({
      ...base,
      pedidosComAlerta: [{ ...pedido, id: "401", prazo: daqui(5) }, { ...pedido, id: "402", prazo: daqui(2) }],
    }, AGORA);
    expect(r.map((a) => a.entityId)).toEqual(["402", "401"]);
  });

  it("a falta provável diz a hora como se lê: hoje, ontem ou o dia", () => {
    const descricao = (marcadoPara: string) =>
      gerarAlertas({ ...base, faltasProvaveis: [{ servicoId: "405", tecnico: "Rui", cliente: "Inês", marcadoPara }] }, AGORA)[0].description;
    expect(descricao("2026-10-15T08:00:00Z")).toContain("estava marcado para hoje às 09:00");
    expect(descricao("2026-10-14T17:30:00Z")).toContain("estava marcado para ontem às 18:30");
    expect(descricao("2026-10-13T08:00:00Z")).toContain("estava marcado para 13/10 às 09:00");
  });

  it("uma hora que não se lê fica como veio", () => {
    expect(quandoEmLisboa("amanhã de manhã", AGORA)).toBe("amanhã de manhã");
  });
});
