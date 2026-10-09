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

  /*
    A OPERAÇÃO, pedido a pedido (08/10/2026). Até aqui os alertas falavam de
    leads, faturas e integrações, e nenhum de um pedido concreto parado. Os
    quatro abaixo vêm das Operações ao vivo, das faltas e dos lotes; são
    opcionais porque cada fonte pode falhar sem derrubar as outras.
  */
  /** Pedidos que as Operações ao vivo marcaram (prazo a acabar, ninguém a responder…). */
  pedidosComAlerta?: Array<{
    id: string; cliente: string | null; tipo: string | null; cidade: string | null;
    nivel: "critico" | "atencao" | "info"; motivo: string; desde: string | null;
  }>;
  /** Pedidos que acabaram sem ser servidos, com o desfecho. */
  pedidosPerdidos?: Array<{
    id: string; cliente: string | null; tipo: string | null; cidade: string | null;
    desfecho: string; criadoEm: string | null;
  }>;
  /** Serviços marcados em que o técnico não marcou "a caminho". */
  faltasProvaveis?: Array<{ servicoId: string; tecnico: string | null; cliente: string | null; marcadoPara: string | null }>;
  /** Lotes de pagamento a técnicos criados e à espera de outra pessoa. */
  lotesPorAprovar?: Array<{ id: string; total: number; criadoEm: string; criadoPor: string | null }>;
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
  /**
   * Um pedido perdido só vale a pena nas primeiras horas: é quando ainda se
   * liga ao cliente e se salva o serviço. Depois disso é estatística (está em
   * Operações › Ao vivo), não ação.
   */
  perdidoHoras: 24,
  /** Um lote por aprovar passa a "alta" ao fim de 1 dia: há técnicos à espera do dinheiro. */
  loteHorasAlta: 24,
} as const;

/** O que fazer em cada alerta das Operações ao vivo (o motivo vem do Laravel). */
const ACAO_DO_MOTIVO: Record<string, { titulo: string; accao: string; doCliente?: boolean }> = {
  personalizado_por_rever: { titulo: "pedido personalizado à espera da Piquet", accao: "Despachar no pedido: definir a duração e as categorias para os convites saírem." },
  ninguem_convidado: { titulo: "ninguém foi convidado", accao: "Não há técnicos para este pedido: ligar ao cliente antes que falhe." },
  ninguem_a_responder: { titulo: "ninguém está a responder", accao: "Ligar a técnicos da zona, ou ao cliente para propor outra hora." },
  prazo_esgotado: { titulo: "o prazo acabou", accao: "Ligar já ao cliente: o pedido vai falhar a qualquer momento." },
  prazo_a_acabar: { titulo: "o prazo está a acabar", accao: "Ver os convidados e puxar por quem ainda não respondeu." },
  cliente_a_escolher: { titulo: "o cliente ainda não escolheu", accao: "Já há quem aceite; lembrar o cliente de escolher e pagar.", doCliente: true },
  pagamento_por_capturar: { titulo: "pagamento por capturar", accao: "Trabalho feito e dinheiro por entrar: \"Tentar cobrar\" no pedido, ou desistir e devolver." },
  cliente_nao_confirmou: { titulo: "o cliente não confirmou o fim", accao: "Perguntar ao cliente se o trabalho ficou feito; se sim, \"Fechar e cobrar\" no pedido.", doCliente: true },
};

/** Desfechos de um pedido perdido que ainda se podem salvar com uma chamada. */
const PERDIDO: Record<string, { priority: AlertPriority; titulo: string; accao: string }> = {
  sem_oferta: { priority: "alta", titulo: "ficou sem técnico", accao: "Ligar ao cliente: propor outra hora ou um técnico de confiança." },
  sem_resposta: { priority: "alta", titulo: "ficou sem resposta dos técnicos", accao: "Ligar ao cliente: propor outra hora ou um técnico de confiança." },
  sem_escolha: { priority: "media", titulo: "acabou sem o cliente escolher", accao: "Perguntar ao cliente o que faltou para avançar." },
  pagamento_falhou: { priority: "media", titulo: "acabou com o pagamento a falhar", accao: "Ligar ao cliente para tentar outro meio de pagamento." },
};

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
      "Abrir o contacto e responder, ou perguntar a técnicos.",
      l.recebidaEm, "lead", l.id,
    ));
  }

  // --- Pedidos com alerta nas Operações ao vivo ----------------------------
  // Um por pedido: são pedidos concretos, com cliente e prazo. A urgência é a
  // do Laravel, mas quando a bola está do lado do cliente não passa de média.
  for (const p of s.pedidosComAlerta ?? []) {
    if (p.nivel === "info") continue;
    const m = ACAO_DO_MOTIVO[p.motivo] ?? { titulo: p.motivo.replace(/_/g, " "), accao: "Abrir o pedido." };
    const prioridade: AlertPriority = m.doCliente ? "media" : p.nivel === "critico" ? "critica" : "alta";
    alertas.push(novo(
      `pedido-${p.motivo}-${p.id}`,
      "operacional",
      prioridade,
      `Pedido #${p.id}: ${m.titulo}`,
      [p.cliente, p.tipo, p.cidade].filter(Boolean).join(" · ") || "Pedido sem detalhe",
      m.accao,
      p.desde ?? new Date(agoraMs).toISOString(), "pedido", p.id,
    ));
  }

  // --- Pedidos perdidos nas últimas horas ---------------------------------
  for (const p of s.pedidosPerdidos ?? []) {
    const r = PERDIDO[p.desfecho];
    if (!r || !p.criadoEm) continue;
    if (agoraMs - Date.parse(p.criadoEm) > LIMITES.perdidoHoras * 3_600_000) continue;
    alertas.push(novo(
      `perdido-${p.id}`,
      "operacional",
      r.priority,
      `Pedido #${p.id} ${r.titulo}`,
      [p.cliente, p.tipo, p.cidade].filter(Boolean).join(" · ") || "Pedido sem detalhe",
      r.accao,
      p.criadoEm, "pedido", p.id,
    ));
  }

  // --- Faltas prováveis ------------------------------------------------------
  // Crítica: há um cliente em casa à espera agora.
  for (const f of s.faltasProvaveis ?? []) {
    alertas.push(novo(
      `falta-${f.servicoId}`,
      "operacional",
      "critica",
      `Possível falta no pedido #${f.servicoId}`,
      `${f.tecnico ?? "O técnico"} não marcou "a caminho"${f.marcadoPara ? ` (marcado para ${f.marcadoPara})` : ""}${f.cliente ? ` · cliente ${f.cliente}` : ""}.`,
      "Ligar ao técnico; se não aparecer, declarar a falta em Qualidade › Faltas.",
      f.marcadoPara ?? new Date(agoraMs).toISOString(), "pedido", f.servicoId,
    ));
  }

  // --- Lotes de pagamento por aprovar --------------------------------------
  for (const l of s.lotesPorAprovar ?? []) {
    const horas = (agoraMs - Date.parse(l.criadoEm)) / 3_600_000;
    alertas.push(novo(
      `lote-${l.id}`,
      "financeiro",
      horas >= LIMITES.loteHorasAlta ? "alta" : "media",
      `Lote de pagamento de ${l.total.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })} por aprovar`,
      `Criado${l.criadoPor ? ` por ${l.criadoPor}` : ""}. Tem de ser aprovado por outra pessoa antes de se pagar.`,
      "Aprovar em Financeiro › Pagamentos a técnicos.",
      l.criadoEm, "lotes", l.id,
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
