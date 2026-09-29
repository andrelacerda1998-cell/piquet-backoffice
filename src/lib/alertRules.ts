import type { DashboardAlert, AlertPriority } from "@/types";

/**
 * Regras que transformam o estado real do negócio em alertas.
 *
 * Antes, a aba de Alertas mostrava uma lista inventada (`mockData.alerts`)
 * guardada em memória: "resolver" um alerta não gravava nada e ao recarregar
 * estava tudo como dantes. Pior do que não ter alertas — dava a sensação de
 * vigilância que não existia.
 *
 * Estas regras só olham para sinais que o backoffice já recolhe. Cada alerta
 * aponta para o ecrã onde se resolve o problema; um alerta que não diz o que
 * fazer a seguir é só ruído.
 */

export interface SinaisDoNegocio {
  /** Leads no estado "novo", com a data de entrada. */
  leadsPorResponder: Array<{ id: string; nome: string; recebidaEm: string }>;
  /** Execuções recentes de cada cron: falhas seguidas indicam integração parada. */
  cronsFalhados: Array<{ job: string; falhasSeguidas: number; ultimoErro: string; ultimaTentativa: string }>;
  /** Tickets de suporte abertos, com a data da última mensagem. */
  ticketsAbertos: Array<{ id: string; assunto: string; canal: string; desde: string }>;
  /** Documentos de técnicos à espera de revisão. */
  documentosPendentes: number;
  /** Faturas de custos com o prazo de pagamento ultrapassado. */
  faturasVencidas: Array<{ fornecedor: string; valorEmDivida: number; venceuEm: string }>;
  /** Obrigações fiscais com o prazo ultrapassado e ainda não pagas. */
  impostosVencidos: Array<{ nome: string; valor: number; venceuEm: string; estimado: boolean }>;
  /** Dias desde o último dia com investimento registado (null = nunca houve). */
  diasSemDadosDeAnuncios: number | null;
  /** Pagamentos recusados nos últimos 7 dias. */
  pagamentosRecusados: number;
}

/**
 * Limiares e urgências — num sítio só, para se poderem afinar sem caçar
 * números pelo código.
 *
 * REGRA DE URGÊNCIA: depende de QUEM TEM A BOLA.
 *
 * - Bola do nosso lado (responder a uma lead, aprovar um documento, pagar uma
 *   fatura, arranjar uma integração): pode ser alta ou crítica — está parado
 *   por nossa causa e resolve-se agindo.
 * - Bola do lado do cliente (esperar que decida sobre um orçamento): NUNCA
 *   passa de média, por muito tempo que demore. Não há nada a "resolver" com
 *   urgência; é acompanhamento, e marcá-lo a vermelho ensina a ignorar o
 *   vermelho — que é o que estraga um ecrã de alertas.
 * - Prazos legais (impostos): crítica sempre, porque a consequência é coima.
 */
export const LIMITES = {
  /** Uma lead por responder passa a alerta ao fim de 1 dia; crítica aos 3. */
  /*
    0 e não 1: a bolinha existe para provocar ação, e numa marketplace de
    serviços ao domicílio a ação urgente é responder HOJE. A regra antiga só
    acendia no dia seguinte — precisamente depois de passar a janela em que
    responder ainda ganha o cliente. Uma lead que entra às 22h e é vista de
    manhã costuma já estar perdida.
  */
  leadDiasAlerta: 0,
  leadDiasCritico: 3,
  /** Um cron falha ocasionalmente; 3 vezes seguidas é avaria. */
  cronFalhasSeguidas: 3,
  /** Suporte sem resposta há mais de 1 dia. */
  ticketDiasAlerta: 1,
  /** A partir de 1 documento já vale a pena aparecer; sobe de urgência com a fila. */
  documentosPendentes: 1,
  documentosPendentesAlta: 10,
  /**
   * À espera da decisão do cliente. Só aparece ao fim de 3 dias — antes disso
   * é o funil a funcionar, não um problema — e fica-se por "média": insistir é
   * boa prática, não urgência.
   */
  /** Recolha de anúncios parada há mais de 2 dias. */
  diasSemAnuncios: 2,
} as const;

const diasEntre = (iso: string, agoraMs: number): number =>
  Math.floor((agoraMs - Date.parse(iso)) / 86_400_000);

const plural = (n: number, sing: string, plur: string) => `${n} ${n === 1 ? sing : plur}`;

export function gerarAlertas(s: SinaisDoNegocio, agoraMs: number): DashboardAlert[] {
  const alertas: DashboardAlert[] = [];
  const novo = (
    id: string, type: DashboardAlert["type"], priority: AlertPriority,
    title: string, description: string, recommendedAction: string,
    createdAt: string, entityType?: string, entityId?: string,
  ): DashboardAlert => ({
    id, type, priority, title, description, createdAt,
    status: "novo", recommendedAction, entityType, entityId,
  });

  // --- Leads por responder -------------------------------------------------
  // Uma a uma, não agregadas: cada lead é um contacto concreto à espera, e
  // agregá-las esconderia a mais antiga no meio das outras.
  for (const l of s.leadsPorResponder) {
    const dias = diasEntre(l.recebidaEm, agoraMs);
    if (dias < LIMITES.leadDiasAlerta) continue;
    alertas.push(novo(
      `lead-sem-resposta-${l.id}`,
      "marketing",
      dias >= LIMITES.leadDiasCritico ? "critica" : "alta",
      dias === 0 ? "Lead nova por responder" : `Lead sem resposta há ${plural(dias, "dia", "dias")}`,
      `${l.nome} pediu contacto e continua no estado "Novo".`,
      "Abrir o pedido e responder, ou perguntar a técnicos.",
      l.recebidaEm, "lead", l.id,
    ));
  }

  // --- Integrações paradas -------------------------------------------------
  for (const c of s.cronsFalhados) {
    if (c.falhasSeguidas < LIMITES.cronFalhasSeguidas) continue;
    alertas.push(novo(
      `cron-${c.job}`,
      "produto",
      "alta",
      `Integração "${c.job}" falhou ${plural(c.falhasSeguidas, "vez seguida", "vezes seguidas")}`,
      c.ultimoErro.slice(0, 200),
      "Ver Produto › Integrações para o erro completo.",
      c.ultimaTentativa, "integracao", c.job,
    ));
  }

  // --- Suporte sem resposta ------------------------------------------------
  for (const t of s.ticketsAbertos) {
    const dias = diasEntre(t.desde, agoraMs);
    if (dias < LIMITES.ticketDiasAlerta) continue;
    alertas.push(novo(
      `ticket-${t.id}`,
      "operacional",
      dias >= 3 ? "critica" : "alta",
      `Ticket sem resposta há ${plural(dias, "dia", "dias")}`,
      `${t.assunto} · ${t.canal}`,
      "Responder em Suporte › Tickets.",
      t.desde, "ticket", t.id,
    ));
  }

  // --- Fila de KYC ---------------------------------------------------------
  if (s.documentosPendentes >= LIMITES.documentosPendentes) {
    alertas.push(novo(
      "kyc-fila",
      "equipa",
      s.documentosPendentes >= LIMITES.documentosPendentesAlta ? "alta" : "media",
      `${plural(s.documentosPendentes, "documento de técnico", "documentos de técnicos")} por aprovar`,
      "Técnicos à espera de aprovação não podem aceitar serviços.",
      "Rever em Técnicos › Aprovações e KYC.",
      new Date(agoraMs).toISOString(), "kyc",
    ));
  }

  // --- Faturas de custos vencidas ------------------------------------------
  for (const f of s.faturasVencidas) {
    const dias = diasEntre(f.venceuEm, agoraMs);
    alertas.push(novo(
      `fatura-vencida-${f.fornecedor}-${f.venceuEm}`,
      "financeiro",
      dias >= 15 ? "critica" : "alta",
      `Fatura de ${f.fornecedor} vencida há ${plural(Math.max(dias, 1), "dia", "dias")}`,
      `${f.valorEmDivida.toFixed(2).replace(".", ",")} € em dívida — atrasos estragam a relação com fornecedores.`,
      "Registar o pagamento em Financeiro › Faturas de custos.",
      f.venceuEm, "fatura",
    ));
  }

  // --- Obrigações fiscais vencidas -----------------------------------------
  // Sempre críticas: prazos fiscais falhados geram coimas, não conversas.
  for (const i of s.impostosVencidos) {
    alertas.push(novo(
      `imposto-vencido-${i.nome}-${i.venceuEm}`,
      "fiscal",
      "critica",
      `${i.nome} com prazo ultrapassado`,
      `${i.valor.toFixed(2).replace(".", ",")} €${i.estimado ? " (estimativa)" : ""} · prazo era ${i.venceuEm.slice(0, 10)}.`,
      "Confirmar o pagamento em Financeiro › Impostos e RH.",
      i.venceuEm, "imposto",
    ));
  }

  // --- Recolha de anúncios parada -----------------------------------------
  if (s.diasSemDadosDeAnuncios !== null && s.diasSemDadosDeAnuncios > LIMITES.diasSemAnuncios) {
    alertas.push(novo(
      "anuncios-parados",
      "marketing",
      "media",
      `Sem dados de anúncios há ${plural(s.diasSemDadosDeAnuncios, "dia", "dias")}`,
      "Pode ser recolha avariada ou campanhas paradas — o Marketing não distingue sozinho.",
      "Carregar em \"Atualizar anúncios\" no Marketing e ler a mensagem.",
      new Date(agoraMs).toISOString(), "marketing",
    ));
  }

  // --- Pagamentos recusados ------------------------------------------------
  if (s.pagamentosRecusados > 0) {
    alertas.push(novo(
      "pagamentos-recusados",
      "financeiro",
      s.pagamentosRecusados >= 5 ? "alta" : "media",
      `${plural(s.pagamentosRecusados, "pagamento recusado", "pagamentos recusados")} nos últimos 7 dias`,
      "Cada recusa é um serviço que pode não ter sido pago.",
      "Ver Financeiro › Pagamentos da app.",
      new Date(agoraMs).toISOString(), "pagamentos",
    ));
  }

  // Mais urgente primeiro; dentro da mesma urgência, o mais antigo à frente —
  // é o que está à espera há mais tempo.
  const ordem: Record<AlertPriority, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
  return alertas.sort((a, b) =>
    ordem[a.priority] - ordem[b.priority] || Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
