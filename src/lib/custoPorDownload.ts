/**
 * Quanto custou, em publicidade, cada instalação de cada app.
 *
 * A conta é uma divisão. O que é difícil é o numerador: a despesa não tem
 * campo "app", tem um NOME de campanha. "[PT] - [Google Play] - Clientes -
 * Download App Android" diz claramente para que app é; "[PT] - [PMAX] -
 * Piquet App - Tráfego Site" não diz nada, e é a maior de todas.
 *
 * Por isso este ficheiro faz duas coisas, e a segunda é a que interessa:
 * atribui o que consegue, e DIZ O QUE NÃO CONSEGUIU. Sem isso, um custo por
 * download de 0,36 € parecia excelente escondendo que 86% do investimento
 * não entrou na conta.
 */

export type Alvo = "cliente" | "profissional";

export interface LinhaGasto {
  campanha: string;
  gasto: number;
}

/**
 * De que app é uma campanha, pelo nome.
 *
 * Regra deliberadamente APERTADA: só atribui quando o nome nomeia o público.
 * Uma regra generosa (tudo o que diga "app" é da app cliente) dava mais
 * cobertura e um número em que não se podia confiar -- e um custo por
 * download errado leva a decidir onde pôr o dinheiro.
 */
export function alvoDaCampanha(nome: string): Alvo | null {
  const n = nome.toLowerCase();
  // Acentos: os nomes reais vêm escritos das duas maneiras.
  if (/t[ée]cnic|profission|vendor/.test(n)) return "profissional";
  if (/client/.test(n)) return "cliente";
  return null;
}

export interface CustoDeApp {
  app: Alvo;
  /** Despesa de campanhas identificadas como sendo desta app. */
  gastoAtribuido: number;
  /** Instalações no mesmo período da despesa. */
  downloads: number;
  /** `null` quando não houve instalações: dividir por zero não é infinito, é "não se sabe". */
  custoPorDownload: number | null;
}

export interface Resultado {
  apps: CustoDeApp[];
  /** Despesa que nenhuma campanha permitiu atribuir a uma app. */
  gastoNaoAtribuido: number;
  gastoTotal: number;
  /** Quanto do investimento entrou nas contas por app, de 0 a 1. */
  cobertura: number;
  /**
   * O custo se TODO o investimento fosse repartido pelas instalações.
   *
   * É o número pessimista, e é o honesto para comparar com outro canal: o
   * dinheiro do PMAX saiu da mesma conta, quer se consiga atribuir ou não.
   */
  custoPorDownloadTudoIncluido: number | null;
}

/**
 * @param gastos     uma linha por campanha, já somada no período.
 * @param downloads  instalações por app, NO MESMO PERÍODO da despesa.
 *
 * O "mesmo período" não é um detalhe. As instalações existem desde junho de
 * 2025 e a despesa só desde junho de 2026: dividir três meses de despesa por
 * dezasseis meses de instalações dava um custo quatro vezes abaixo do real.
 */
export function custoPorDownload(
  gastos: LinhaGasto[],
  downloads: Record<Alvo, number>,
): Resultado {
  const porApp: Record<Alvo, number> = { cliente: 0, profissional: 0 };
  let naoAtribuido = 0;

  for (const g of gastos) {
    const alvo = alvoDaCampanha(g.campanha);
    if (alvo) porApp[alvo] += g.gasto;
    else naoAtribuido += g.gasto;
  }

  const gastoTotal = porApp.cliente + porApp.profissional + naoAtribuido;
  const totalDownloads = downloads.cliente + downloads.profissional;

  const apps: CustoDeApp[] = (["cliente", "profissional"] as const).map((app) => ({
    app,
    gastoAtribuido: porApp[app],
    downloads: downloads[app],
    custoPorDownload: downloads[app] > 0 ? porApp[app] / downloads[app] : null,
  }));

  return {
    apps,
    gastoNaoAtribuido: naoAtribuido,
    gastoTotal,
    cobertura: gastoTotal > 0 ? (gastoTotal - naoAtribuido) / gastoTotal : 0,
    custoPorDownloadTudoIncluido: totalDownloads > 0 ? gastoTotal / totalDownloads : null,
  };
}
