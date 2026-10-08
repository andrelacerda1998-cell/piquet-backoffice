import { describe, it, expect } from "vitest";
import { conferir, csvDoLote, estadoDepoisDePagar, lerExtrato, podeAprovar, validarLinhas, type Movimento } from "./lotesPagamento";

const saldos = [
  { id: 1, vendor_name: "Carlos Mendes", iban: "PT50000201231234567890154", balance: 150 },
  { id: 2, vendor_name: "Rui Sousa", iban: null, balance: 80 },
  { id: 3, vendor_name: "Ana Lopes", iban: "PT50000201231234567890999", balance: 60, payout_blocker: "at_user_missing" },
];

describe("validarLinhas", () => {
  it("um lote certo não tem erros", () => {
    expect(validarLinhas([{ vendor_id: 1, valor: 150 }], saldos, new Set())).toEqual([]);
  });

  it("não se paga mais do que o saldo, nem sem IBAN, nem retido, nem duas vezes", () => {
    const erros = validarLinhas(
      [{ vendor_id: 1, valor: 150.01 }, { vendor_id: 2, valor: 80 }, { vendor_id: 3, valor: 60 }, { vendor_id: 1, valor: 10 }],
      saldos, new Set(),
    );
    expect(erros).toEqual([
      "O valor de Carlos Mendes é maior do que o saldo (150.00 €).",
      "Rui Sousa não tem IBAN.",
      "Ana Lopes tem o pagamento retido (at_user_missing).",
      "Carlos Mendes aparece duas vezes.",
    ]);
  });

  it("um técnico só pode estar num lote aberto de cada vez", () => {
    expect(validarLinhas([{ vendor_id: 1, valor: 50 }], saldos, new Set([1]))).toEqual(["Carlos Mendes já está noutro lote por pagar."]);
  });

  it("sem saldo na lista, não entra; lote vazio, também não", () => {
    expect(validarLinhas([{ vendor_id: 9, valor: 5 }], saldos, new Set())).toEqual(["técnico 9 não tem saldo por pagar."]);
    expect(validarLinhas([], saldos, new Set())).toEqual(["O lote não tem técnicos."]);
  });
});

describe("podeAprovar", () => {
  it("quem criou não aprova", () => {
    expect(podeAprovar({ estado: "rascunho", criado_por: "andre" }, "andre").pode).toBe(false);
    expect(podeAprovar({ estado: "rascunho", criado_por: "andre" }, "rodrigo").pode).toBe(true);
  });

  it("só um rascunho se aprova", () => {
    expect(podeAprovar({ estado: "aprovado", criado_por: "andre" }, "rodrigo").pode).toBe(false);
  });
});

describe("estadoDepoisDePagar", () => {
  it("fica pago só quando todas as linhas foram pagas", () => {
    expect(estadoDepoisDePagar([{ estado: "pago" }, { estado: "pago" }])).toBe("pago");
    expect(estadoDepoisDePagar([{ estado: "pago" }, { estado: "falhou" }])).toBe("aprovado");
  });
});

describe("lerExtrato", () => {
  it("lê o formato com cabeçalho do banco, ponto e vírgula e valor com sinal", () => {
    const csv = [
      "Conta;PT50 0010 0000 6316 4940 0016 8",
      "Período;01-10-2026 a 08-10-2026",
      "",
      "Data Mov.;Data Valor;Descrição do Movimento;Valor em EUR;Saldo em EUR",
      "07-10-2026;07-10-2026;TRF P/ CARLOS MENDES;-1.150,00;3.200,10",
      '06-10-2026;06-10-2026;"PAYSHOP; LIQUIDACAO";420,55;4.350,10',
    ].join("\n");
    expect(lerExtrato(csv)).toEqual([
      { data: "2026-10-07", descricao: "TRF P/ CARLOS MENDES", valor: -1150 },
      { data: "2026-10-06", descricao: "PAYSHOP; LIQUIDACAO", valor: 420.55 },
    ]);
  });

  it("lê o formato com colunas de débito e crédito, vírgulas e datas ISO", () => {
    const csv = "Data,Descricao,Debito,Credito\n2026-10-07,TRF SEPA ANA LOPES,60.00,\n2026-10-08,DEPOSITO,,100.00";
    expect(lerExtrato(csv)).toEqual([
      { data: "2026-10-07", descricao: "TRF SEPA ANA LOPES", valor: -60 },
      { data: "2026-10-08", descricao: "DEPOSITO", valor: 100 },
    ]);
  });

  it("sem cabeçalho reconhecível não inventa movimentos", () => {
    expect(lerExtrato("isto não é um extrato")).toEqual([]);
  });
});

describe("conferir", () => {
  const linha = (id: string, valor: number, vendor_name: string, iban: string | null = null) =>
    ({ id, valor, vendor_name, iban, pago_em: "2026-10-07T15:00:00Z" });
  const mov = (data: string, descricao: string, valor: number): Movimento => ({ data, descricao, valor });

  it("casa pelo nome quando há duas saídas iguais", () => {
    const r = conferir(
      [linha("a", 80, "Rui Sousa"), linha("b", 80, "Carlos Mendes")],
      [mov("2026-10-07", "TRF P/ CARLOS MENDES", -80), mov("2026-10-07", "TRF P/ RUI SOUSA", -80)],
    );
    expect(r.map((c) => [c.linhaId, c.movimento.descricao, c.por])).toEqual([
      ["a", "TRF P/ RUI SOUSA", "nome"],
      ["b", "TRF P/ CARLOS MENDES", "nome"],
    ]);
  });

  it("casa pelo fim do IBAN", () => {
    const r = conferir([linha("a", 60, "Ana", "PT50 0002 0123 1234 5678 9099 9")], [mov("2026-10-08", "SEPA PT500002012312345678909999", -60)]);
    expect(r[0].por).toBe("iban");
  });

  it("só por valor quando é a única saída possível", () => {
    expect(conferir([linha("a", 42.5, "Zé")], [mov("2026-10-07", "TRF", -42.5)])[0].por).toBe("valor");
    expect(conferir([linha("a", 42.5, "Zé")], [mov("2026-10-07", "TRF", -42.5), mov("2026-10-08", "TRF", -42.5)])).toEqual([]);
  });

  it("não casa entradas, valores diferentes nem datas longe", () => {
    expect(conferir([linha("a", 80, "Rui Sousa")], [
      mov("2026-10-07", "RUI SOUSA", 80),
      mov("2026-10-07", "RUI SOUSA", -80.01),
      mov("2026-09-20", "RUI SOUSA", -80),
      mov("2026-10-30", "RUI SOUSA", -80),
    ])).toEqual([]);
  });

  it("uma linha sem pista não leva o movimento que tem o nome de outra", () => {
    const r = conferir(
      [linha("ze", 80, "Zé"), linha("rui", 80, "Rui Sousa")],
      [mov("2026-10-07", "TRF P/ RUI SOUSA", -80)],
    );
    expect(r.map((c) => [c.linhaId, c.por])).toEqual([["rui", "nome"]]);
  });

  it("cada movimento serve uma linha só", () => {
    const r = conferir([linha("a", 80, "Rui Sousa"), linha("b", 80, "Rui Sousa")], [mov("2026-10-07", "RUI SOUSA", -80)]);
    expect(r).toHaveLength(1);
  });
});

describe("csvDoLote", () => {
  it("só as linhas por pagar, com o IBAN sem espaços", () => {
    const { linhas } = csvDoLote({
      id: "12345678-aaaa",
      linhas: [
        { id: "1", vendor_id: 1, vendor_name: "Carlos", iban: "PT50 0002", valor: 150, estado: "por_pagar", erro: null, pago_em: null, confirmado_em: null, movimento: null },
        { id: "2", vendor_id: 2, vendor_name: "Rui", iban: "PT50 0003", valor: 80, estado: "pago", erro: null, pago_em: null, confirmado_em: null, movimento: null },
      ],
    });
    expect(linhas).toEqual([["Carlos", "PT500002", "150,00", "Piquet 12345678"]]);
  });
});
