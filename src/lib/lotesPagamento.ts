/**
 * Lotes de pagamento a técnicos: as regras, sem base de dados nem rede.
 *
 * Até 08/10/2026 pagar um técnico era um clique que zerava a carteira, sem
 * segunda pessoa e sem prova de que a transferência saiu. Agora:
 *
 *   rascunho ── aprovar (outra pessoa) ──▶ aprovado ── marcar pago ──▶ pago
 *       └──────────────── cancelar ◀─────────────┘
 *
 * e cada linha paga é depois conferida contra o extrato do banco.
 */

export type EstadoLote = "rascunho" | "aprovado" | "pago" | "cancelado";
export type EstadoLinha = "por_pagar" | "a_pagar" | "pago" | "falhou" | "confirmado";

export interface LinhaDoLote {
  id: string;
  vendor_id: number;
  vendor_name: string | null;
  iban: string | null;
  valor: number;
  estado: EstadoLinha;
  erro: string | null;
  pago_em: string | null;
  confirmado_em: string | null;
  movimento: Movimento | null;
}

export interface Lote {
  id: string;
  estado: EstadoLote;
  total: number;
  notas: string | null;
  criado_por: string;
  criado_por_email: string | null;
  criado_em: string;
  aprovado_por: string | null;
  aprovado_por_email: string | null;
  aprovado_em: string | null;
  pago_por_email: string | null;
  pago_em: string | null;
  linhas: LinhaDoLote[];
}

/** O que a lista de saldos do Laravel diz de cada técnico. */
export interface SaldoDoTecnico {
  id: number;
  vendor_name: string | null;
  iban: string | null;
  balance: number;
  payout_blocker?: string | null;
}

export const cent = (v: number) => Math.round(v * 100);

/**
 * As linhas que se pedem para um lote novo, verificadas contra os saldos de
 * agora. Devolve os erros; lista vazia = pode criar.
 */
export function validarLinhas(
  pedidas: Array<{ vendor_id: number; valor: number }>,
  saldos: readonly SaldoDoTecnico[],
  jaEmLoteAberto: ReadonlySet<number>,
): string[] {
  const erros: string[] = [];
  if (pedidas.length === 0) erros.push("O lote não tem técnicos.");
  const porId = new Map(saldos.map((s) => [s.id, s]));
  const vistos = new Set<number>();

  for (const p of pedidas) {
    const s = porId.get(p.vendor_id);
    const nome = s?.vendor_name ?? `técnico ${p.vendor_id}`;
    if (vistos.has(p.vendor_id)) { erros.push(`${nome} aparece duas vezes.`); continue; }
    vistos.add(p.vendor_id);
    if (!s) { erros.push(`${nome} não tem saldo por pagar.`); continue; }
    if (jaEmLoteAberto.has(p.vendor_id)) erros.push(`${nome} já está noutro lote por pagar.`);
    if (!s.iban) erros.push(`${nome} não tem IBAN.`);
    if (s.payout_blocker) erros.push(`${nome} tem o pagamento retido (${s.payout_blocker}).`);
    if (!(p.valor > 0)) erros.push(`O valor de ${nome} tem de ser positivo.`);
    else if (cent(p.valor) > cent(s.balance)) erros.push(`O valor de ${nome} é maior do que o saldo (${s.balance.toFixed(2)} €).`);
  }
  return erros;
}

/**
 * Quem pode aprovar: outra pessoa que não quem criou. É o ponto do lote — a
 * mesma pessoa a preparar e a autorizar uma saída de dinheiro é exatamente o
 * que havia antes.
 */
export function podeAprovar(lote: Pick<Lote, "estado" | "criado_por">, staffId: string): { pode: boolean; porque?: string } {
  if (lote.estado !== "rascunho") return { pode: false, porque: "Só um lote em rascunho se aprova." };
  if (lote.criado_por === staffId) return { pode: false, porque: "Quem criou o lote não o pode aprovar: tem de ser outra pessoa." };
  return { pode: true };
}

/** O estado do lote depois de tentar pagar as linhas. */
export function estadoDepoisDePagar(linhas: ReadonlyArray<Pick<LinhaDoLote, "estado">>): EstadoLote {
  return linhas.every((l) => l.estado === "pago" || l.estado === "confirmado") ? "pago" : "aprovado";
}

// ------------------------------------------------------------- extrato

export interface Movimento {
  data: string; // AAAA-MM-DD
  descricao: string;
  valor: number; // negativo = saiu da conta
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function numeroPt(raw: string): number | null {
  let s = raw.replace(/[€\s ]/g, "").trim();
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  if (s.endsWith("-")) { negativo = true; s = s.slice(0, -1); }
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -Math.abs(n) : n;
}

function dataIso(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function dividir(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "", aspas = false;
  for (const ch of linha) {
    if (ch === '"') { aspas = !aspas; continue; }
    if (ch === sep && !aspas) { out.push(atual); atual = ""; continue; }
    atual += ch;
  }
  out.push(atual);
  return out.map((c) => c.trim());
}

/**
 * Lê o CSV de movimentos que o homebanking exporta.
 *
 * Tolerante de propósito: cada banco põe linhas de cabeçalho antes da tabela,
 * usa ";" ou ",", e ou tem uma coluna "Valor" com sinal ou duas, "Débito" e
 * "Crédito". Procura-se a linha de cabeçalho pelos nomes das colunas.
 */
export function lerExtrato(texto: string): Movimento[] {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const sep = (linhas.slice(0, 15).join("\n").match(/;/g)?.length ?? 0) > 0 ? ";" : ",";

  let cab = -1;
  let col = { data: -1, descricao: -1, valor: -1, debito: -1, credito: -1 };
  for (let i = 0; i < Math.min(linhas.length, 40); i++) {
    const c = dividir(linhas[i], sep).map(normalizar);
    const data = c.findIndex((x) => x.startsWith("data"));
    const descricao = c.findIndex((x) => x.includes("descri") || x.includes("movimento") || x.includes("detalhe"));
    const valor = c.findIndex((x) => /^(valor|montante|importancia)/.test(x) && !x.includes("saldo"));
    const debito = c.findIndex((x) => x.startsWith("debito"));
    const credito = c.findIndex((x) => x.startsWith("credito"));
    if (data >= 0 && descricao >= 0 && (valor >= 0 || debito >= 0)) {
      cab = i; col = { data, descricao, valor, debito, credito };
      break;
    }
  }
  if (cab < 0) return [];

  const out: Movimento[] = [];
  for (const linha of linhas.slice(cab + 1)) {
    const c = dividir(linha, sep);
    const data = dataIso(c[col.data] ?? "");
    if (!data) continue;
    let valor: number | null;
    if (col.valor >= 0) valor = numeroPt(c[col.valor] ?? "");
    else {
      const d = numeroPt(c[col.debito] ?? "");
      const cr = col.credito >= 0 ? numeroPt(c[col.credito] ?? "") : null;
      valor = d ? -Math.abs(d) : cr ? Math.abs(cr) : null;
    }
    if (valor == null) continue;
    out.push({ data, descricao: c[col.descricao] ?? "", valor });
  }
  return out;
}

export interface Conferencia {
  linhaId: string;
  movimento: Movimento;
  por: "iban" | "nome" | "valor";
}

const DIA = 86_400_000;

/**
 * Casa cada linha paga com uma saída do extrato.
 *
 *  - o valor tem de bater ao cêntimo;
 *  - a data, entre 3 dias antes e 10 dias depois de se marcar como pago;
 *  - se a descrição tiver o fim do IBAN ou um apelido do técnico, ganha;
 *  - só por valor e data quando é a ÚNICA saída possível — com duas de 80 €
 *    na mesma semana e nada que as distinga, não se adivinha;
 *  - cada movimento serve uma linha só.
 */
export function conferir(
  linhas: ReadonlyArray<Pick<LinhaDoLote, "id" | "valor" | "vendor_name" | "iban" | "pago_em">>,
  movimentos: readonly Movimento[],
): Conferencia[] {
  const usados = new Set<number>();
  const out: Conferencia[] = [];

  const pistas = (l: (typeof linhas)[number]) => {
    const iban = (l.iban ?? "").replace(/\s/g, "");
    const nomes = normalizar(l.vendor_name ?? "").split(/\s+/).filter((n) => n.length >= 3);
    return { fimIban: iban.length >= 6 ? iban.slice(-6) : null, nomes };
  };

  const possiveisPara = (l: (typeof linhas)[number]) => {
    const pago = Date.parse(l.pago_em ?? "");
    return movimentos
      .map((m, i) => ({ m, i }))
      .filter(({ m, i }) => {
        if (usados.has(i) || m.valor >= 0 || cent(-m.valor) !== cent(l.valor)) return false;
        const t = Date.parse(m.data);
        return t >= pago - 3 * DIA && t <= pago + 10 * DIA;
      });
  };
  const desc = (m: Movimento) => normalizar(m.descricao);

  /*
    Duas passagens. Primeiro só as linhas com pista (fim do IBAN ou apelido
    na descrição); depois, as que sobram, só quando há UMA saída possível.
    Numa passagem só, uma linha sem pista que viesse primeiro levava o
    movimento que tinha o nome de outra.
  */
  const conferidas = new Set<string>();
  for (const l of linhas) {
    if (!l.pago_em) continue;
    const { fimIban, nomes } = pistas(l);
    const possiveis = possiveisPara(l);
    const porIban = fimIban ? possiveis.find(({ m }) => desc(m).replace(/\s/g, "").includes(fimIban.toLowerCase())) : undefined;
    const porNome = porIban ? undefined : possiveis.find(({ m }) => nomes.some((n) => desc(m).includes(n)));
    const escolhido = porIban ?? porNome;
    if (!escolhido) continue;
    usados.add(escolhido.i);
    conferidas.add(l.id);
    out.push({ linhaId: l.id, movimento: escolhido.m, por: porIban ? "iban" : "nome" });
  }
  for (const l of linhas) {
    if (!l.pago_em || conferidas.has(l.id)) continue;
    const possiveis = possiveisPara(l);
    if (possiveis.length !== 1) continue;
    usados.add(possiveis[0].i);
    out.push({ linhaId: l.id, movimento: possiveis[0].m, por: "valor" });
  }
  return out;
}

/** O ficheiro para fazer as transferências: uma linha por técnico. */
export function csvDoLote(lote: Pick<Lote, "id" | "linhas">): { cabecalho: string[]; linhas: string[][] } {
  return {
    cabecalho: ["Nome", "IBAN", "Valor (€)", "Referência"],
    linhas: lote.linhas
      .filter((l) => l.estado === "por_pagar" || l.estado === "falhou")
      .map((l) => [l.vendor_name ?? "", (l.iban ?? "").replace(/\s/g, ""), l.valor.toFixed(2).replace(".", ","), `Piquet ${lote.id.slice(0, 8)}`]),
  };
}
