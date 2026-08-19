import type { MarketingCampaign } from "@/types";

/**
 * Objetivo de uma campanha, deduzido do nome.
 *
 * Existe porque avaliar tudo pelo ROAS é errado e estava a dar conclusões
 * falsas nos dois sentidos:
 *
 * - as campanhas de notoriedade ([ALCANCE], [ENGAGEMENT]) apareciam todas como
 *   "Má" com ROAS 0,00× — mas nenhuma foi feita para vender, e o que se lhes
 *   pede é alcance barato;
 * - as de instalação ([Google Play] - Download App) mostravam ROAS 2,48×
 *   apoiado num valor que a plataforma atribui a INSTALAÇÕES, não em dinheiro
 *   cobrado. O que interessa aí é quanto custou cada instalação.
 *
 * A convenção de nomes já existe nas contas (Meta e Google), por isso lê-se
 * daí em vez de exigir configuração manual.
 */
export type CampaignObjective = "instalacao" | "leads" | "trafego" | "notoriedade" | "indefinido";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function campaignObjective(nome: string | null | undefined): CampaignObjective {
  const n = norm(nome ?? "");
  if (!n) return "indefinido";

  // Ordem deliberada: os sinais mais específicos primeiro. "[PIQUET APP]"
  // aparece em campanhas de engagement, por isso "app" sozinho não chega para
  // dizer instalação — exige-se "download"/"install" ou a loja.
  if (/\bdownload|install|google play|app store|\bapk\b/.test(n)) return "instalacao";
  if (/\blead/.test(n)) return "leads";
  if (/alcance|engagement|envolvimento|awareness|notoriedade|\breach\b|visitas ao perfil|seguidores/.test(n)) return "notoriedade";
  if (/trafego|traffic|visitas|cliques|\bpmax\b|site/.test(n)) return "trafego";
  return "indefinido";
}

export const OBJECTIVE_LABEL: Record<CampaignObjective, string> = {
  instalacao: "Instalações",
  leads: "Leads",
  trafego: "Tráfego",
  notoriedade: "Notoriedade",
  indefinido: "Sem objetivo",
};

/**
 * A métrica que decide se a campanha está a correr bem, para o SEU objetivo.
 * `melhorQuandoBaixo` porque quase todas são custos — só assim se sabe para
 * que lado olhar ao comparar.
 */
export interface KeyMetric {
  label: string;
  /** null quando não há denominador (ex.: zero instalações) — não se inventa. */
  value: number | null;
  format: "currency" | "percent" | "number";
  melhorQuandoBaixo: boolean;
  /** Explicação para quem passa o rato por cima. */
  hint: string;
}

export function keyMetric(c: MarketingCampaign, objetivo = campaignObjective(c.campaignName)): KeyMetric {
  const div = (a: number, b: number) => (b > 0 ? a / b : null);
  switch (objetivo) {
    case "instalacao":
      return {
        label: "Custo/instalação",
        value: div(c.investment, c.leads),
        format: "currency",
        melhorQuandoBaixo: true,
        hint: "Investimento ÷ instalações reportadas pela plataforma",
      };
    case "leads":
      return {
        label: "Custo/lead",
        value: div(c.investment, c.leads),
        format: "currency",
        melhorQuandoBaixo: true,
        hint: "Investimento ÷ leads atribuídas",
      };
    case "trafego":
      return {
        label: "Custo/clique",
        value: div(c.investment, c.clicks),
        format: "currency",
        melhorQuandoBaixo: true,
        hint: "Investimento ÷ cliques",
      };
    case "notoriedade":
      return {
        label: "Custo/mil pessoas",
        value: c.impressions > 0 ? (c.investment / c.impressions) * 1000 : null,
        format: "currency",
        melhorQuandoBaixo: true,
        hint: "CPM — investimento por cada mil impressões. Numa campanha de notoriedade é isto que se compara, não o retorno.",
      };
    default:
      return {
        label: "Custo/clique",
        value: div(c.investment, c.clicks),
        format: "currency",
        melhorQuandoBaixo: true,
        hint: "Objetivo não identificado pelo nome da campanha — mostra-se o custo por clique",
      };
  }
}

/**
 * Comparação com as outras campanhas do MESMO objetivo.
 *
 * Deliberadamente relativa: não há referências de mercado fiáveis para a
 * dimensão da Piquet, e inventar limiares ("bom é abaixo de 0,50 €") seria
 * ficção com ar de rigor. Comparar com a mediana das próprias campanhas é
 * factual e é o que permite decidir onde pôr o próximo euro.
 */
export type Comparacao = "melhor" | "media" | "pior" | "sem_comparacao" | "sem_dados";

export function compararComPares(
  campanha: MarketingCampaign,
  todas: MarketingCampaign[],
): Comparacao {
  const objetivo = campaignObjective(campanha.campaignName);
  const minha = keyMetric(campanha, objetivo).value;
  if (minha === null) return "sem_dados";

  const pares = todas
    .filter((c) => c.id !== campanha.id && campaignObjective(c.campaignName) === objetivo)
    .map((c) => keyMetric(c, objetivo).value)
    .filter((v): v is number => v !== null);
  // Uma campanha sozinha no seu objetivo não tem com que ser comparada.
  if (pares.length < 1) return "sem_comparacao";

  const ord = [...pares].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  const mediana = ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2;
  if (mediana === 0) return "sem_comparacao";

  const melhorQuandoBaixo = keyMetric(campanha, objetivo).melhorQuandoBaixo;
  const razao = minha / mediana;
  // ±15% em torno da mediana conta como "na média" — abaixo disso é ruído.
  if (razao >= 0.85 && razao <= 1.15) return "media";
  const abaixo = razao < 0.85;
  return abaixo === melhorQuandoBaixo ? "melhor" : "pior";
}

export const COMPARACAO_UI: Record<Comparacao, { label: string; tone: string; hint: string }> = {
  melhor: { label: "Acima da média", tone: "bg-success-light text-success", hint: "Melhor do que a mediana das campanhas com o mesmo objetivo" },
  media: { label: "Na média", tone: "bg-info-light text-info", hint: "Em linha com as outras campanhas do mesmo objetivo" },
  pior: { label: "Abaixo da média", tone: "bg-danger-light text-danger", hint: "Pior do que a mediana das campanhas com o mesmo objetivo" },
  sem_comparacao: { label: "Única no objetivo", tone: "bg-surface-subtle text-text-secondary", hint: "Não há outra campanha com o mesmo objetivo para comparar" },
  sem_dados: { label: "Sem dados", tone: "bg-surface-subtle text-text-muted", hint: "Sem métricas suficientes para avaliar" },
};

/** O ROAS só diz alguma coisa quando a campanha gera receita medida. */
export function roasFazSentido(c: MarketingCampaign): boolean {
  return campaignObjective(c.campaignName) === "leads" && c.piquetRevenue > 0;
}
