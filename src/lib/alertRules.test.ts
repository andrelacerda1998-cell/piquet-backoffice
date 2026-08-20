import { describe, it, expect } from "vitest";
import { gerarAlertas, LIMITES, type SinaisDoNegocio } from "./alertRules";

const AGORA = Date.parse("2026-08-20T12:00:00Z");
const haDias = (n: number) => new Date(AGORA - n * 86_400_000).toISOString();

const vazio: SinaisDoNegocio = {
  leadsPorResponder: [], cronsFalhados: [], ticketsAbertos: [],
  orcamentosSemResposta: [], faturasVencidas: [], impostosVencidos: [],
  documentosPendentes: 0, diasSemDadosDeAnuncios: null, pagamentosRecusados: 0,
};

describe("gerarAlertas", () => {
  it("sem problemas, não inventa alertas", () => {
    // O contrário do que fazia o mock: mostrava sempre a mesma lista fixa.
    expect(gerarAlertas(vazio, AGORA)).toEqual([]);
  });

  it("uma lead de hoje ainda não é alerta", () => {
    const r = gerarAlertas({ ...vazio,
      leadsPorResponder: [{ id: "1", nome: "Ana", recebidaEm: haDias(0) }] }, AGORA);
    expect(r).toHaveLength(0);
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

  it("orçamento enviado sem resposta: alto a 1 dia, crítico aos 3", () => {
    const o = (dias: number) => gerarAlertas({ ...vazio,
      orcamentosSemResposta: [{ id: "1", nome: "Ana", enviadoDesde: haDias(dias), valor: 120 }] }, AGORA);
    expect(o(0)).toHaveLength(0);
    expect(o(1)[0].priority).toBe("alta");
    expect(o(1)[0].description).toContain("120,00 €");
    expect(o(3)[0].priority).toBe("critica");
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
      orcamentosSemResposta: [{ id: "2", nome: "Rui", enviadoDesde: haDias(2), valor: null }],
      faturasVencidas: [{ fornecedor: "X", valorEmDivida: 10, venceuEm: haDias(1) }],
      impostosVencidos: [{ nome: "IVA", valor: 5, venceuEm: haDias(1), estimado: false }],
      documentosPendentes: 40, diasSemDadosDeAnuncios: 10, pagamentosRecusados: 6,
    }, AGORA);
    expect(r.length).toBe(9);
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
});
