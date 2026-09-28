/**
 * Qualidade a partir das avaliações REAIS dos clientes.
 *
 * O ecrã mostrava: NPS 62 (não há inquérito de NPS em lado nenhum), uma série
 * mensal gerada por `4.3 + (i % 3) * 0.15`, uma distribuição de estrelas com
 * `star * 30` quando não havia dados, e cinco "motivos de reclamação" com
 * percentagens escritas à mão no código. Nada disso vinha de lado nenhum.
 *
 * O que existe mesmo é `services.rating_by_customer` — a nota que o cliente dá
 * no fim — já exposta pela API de admin. É pouco e é verdade, e é a partir
 * disso que se pode agir: ver quem levou uma ou duas estrelas, e quantos
 * serviços ninguém avaliou.
 */

export interface ServicoAvaliavel {
  id: string;
  status: string;
  rating?: number;
  completedAt?: string;
  requestedAt?: string;
  technicianName?: string;
  customerName?: string;
  categoryName?: string;
  city?: string;
}

export interface ServicoMalAvaliado {
  id: string;
  nota: number;
  quando: string | null;
  tecnico: string | null;
  cliente: string | null;
  categoria: string | null;
}

export interface Qualidade {
  /** Serviços concluídos no período coberto. */
  concluidos: number;
  /** Quantos desses têm nota do cliente. */
  avaliados: number;
  /** Média das notas, ou `null` quando ainda não há nenhuma. */
  media: number | null;
  /** Contagem por estrela, de 1 a 5. */
  distribuicao: { estrelas: number; quantos: number }[];
  /** Média por mês, só nos meses que têm avaliações. */
  porMes: { mes: string; media: number; avaliados: number }[];
  /** Notas de 1 ou 2 estrelas, da mais recente para a mais antiga. */
  insatisfeitos: ServicoMalAvaliado[];
}

/** Estados que contam como serviço feito — os únicos que podiam ter nota. */
const CONCLUIDOS = new Set(["concluido", "finalizado", "fechado"]);

const nota = (s: ServicoAvaliavel): number | null => {
  const n = Number(s.rating);
  // Zero não é uma nota: é a ausência de nota gravada como número.
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
};

const quando = (s: ServicoAvaliavel): string | null => s.completedAt || s.requestedAt || null;

export function construirQualidade(servicos: ServicoAvaliavel[]): Qualidade {
  const concluidosLista = servicos.filter((s) => CONCLUIDOS.has(s.status));

  const comNota: Array<{ s: ServicoAvaliavel; n: number }> = [];
  for (const s of concluidosLista) {
    const n = nota(s);
    if (n != null) comNota.push({ s, n });
  }

  const media = comNota.length
    ? Math.round((comNota.reduce((a, x) => a + x.n, 0) / comNota.length) * 100) / 100
    : null;

  const distribuicao = [1, 2, 3, 4, 5].map((estrelas) => ({
    estrelas,
    quantos: comNota.filter((x) => Math.round(x.n) === estrelas).length,
  }));

  // Média por mês. Só entram meses com avaliações: desenhar um mês a zero
  // diria "a qualidade caiu a pique", quando o que houve foi silêncio.
  const porMesMapa = new Map<string, { soma: number; n: number }>();
  for (const { s, n } of comNota) {
    const mes = (quando(s) ?? "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mes)) continue;
    const cur = porMesMapa.get(mes) ?? { soma: 0, n: 0 };
    cur.soma += n;
    cur.n++;
    porMesMapa.set(mes, cur);
  }
  const porMes = [...porMesMapa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, v]) => ({ mes, media: Math.round((v.soma / v.n) * 100) / 100, avaliados: v.n }));

  const insatisfeitos = comNota
    .filter((x) => x.n <= 2)
    .map(({ s, n }) => ({
      id: s.id,
      nota: n,
      quando: quando(s),
      tecnico: s.technicianName ?? null,
      cliente: s.customerName ?? null,
      categoria: s.categoryName ?? null,
    }))
    .sort((a, b) => (b.quando ?? "").localeCompare(a.quando ?? ""));

  return {
    concluidos: concluidosLista.length,
    avaliados: comNota.length,
    media,
    distribuicao,
    porMes,
    insatisfeitos,
  };
}
