import type { DashboardAlert, AlertPriority, Permission } from "@/types";
import { ordenarAlertas } from "@/lib/ordemDosAlertas";

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
  /** Leads no estado "novo", com a data de entrada (e se pediram urgência). */
  leadsPorResponder: Array<{ id: string; nome: string; recebidaEm: string; urgente?: boolean }>;
  /** Execuções recentes de cada cron: falhas seguidas indicam integração parada. */
  cronsFalhados: Array<{ job: string; falhasSeguidas: number; ultimoErro: string; ultimaTentativa: string }>;
  /**
   * Tickets de suporte abertos, com a data da última mensagem. `esperaResposta`:
   * a última mensagem é do cliente (false = já lhe respondemos, a bola é dele).
   */
  ticketsAbertos: Array<{
    id: string; assunto: string; canal: string; desde: string;
    prioridade?: string; categoria?: string | null; abertoEm?: string; esperaResposta?: boolean;
  }>;
  /** Documentos de técnicos à espera de revisão. */
  documentosPendentes: number;
  /** Quantos estão à espera há mais de 24 h, e desde quando o mais antigo (quando se sabe). */
  documentosAntigos?: { quantos: number; maisAntigo: string | null };
  /** As integrações do painel que falharam ou deixaram de correr quando deviam. */
  integracoes?: Array<{ job: string; nome: string; estado: "falha" | "atrasado"; detalhe: string; quando: string | null; falhasSeguidas: number }>;
  /** Cidades onde houve pedidos nas últimas 24 h e não há técnicos online. */
  cidadesSemOferta?: Array<{ cidade: string; pedidos: number }>;
  /** Pedidos que começam já (≤ 15 min) e cujo técnico ainda não saiu. */
  faltasIminentes?: Array<{ servicoId: string; tecnico: string | null; cliente: string | null; comecaEm: string }>;
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
    /** Quando o pedido entrou no estado em que está (o backend novo manda-o). */
    estadoDesde?: string | null;
    /** Até quando correm os convites (os pedidos à procura de técnico). */
    prazo?: string | null;
  }>;
  /** Pedidos que acabaram sem ser servidos, com o desfecho. */
  pedidosPerdidos?: Array<{
    id: string; cliente: string | null; tipo: string | null; cidade: string | null;
    desfecho: string; criadoEm: string | null;
  }>;
  /** Serviços marcados em que o técnico não marcou "a caminho". `marcadoPara`: o instante (ISO). */
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
  /**
   * Uma cobrança que falhou tenta-se outra vez sozinha: só é alerta passados
   * 30 minutos no estado (quando se sabe desde quando está nele).
   */
  capturaMinutos: 30,
  /** Um contacto que pediu urgência passa a crítico se ninguém responder em 15 minutos. */
  leadUrgenteMinutos: 15,
  /** Horas sem resposta a um ticket, pela importância que tem. */
  ticketHoras: { critica: 1, alta: 4, media: 24, baixa: 24 } as Record<string, number>,
  /** Uma reclamação aberta há mais de um dia já devia estar resolvida. */
  reclamacaoHoras: 24,
  /** Um documento de técnico à espera há mais de um dia é um técnico parado por nossa causa. */
  documentoHoras: 24,
} as const;

/**
 * Quem trata de cada alerta, por permissão (basta uma). Um alerta só aparece
 * a quem o pode resolver: as Finanças não precisam de ver contactos por
 * responder, e a Operação não precisa de ver faturas vencidas.
 */
export const DONOS: Record<string, Permission[]> = {
  operacao: ["view_services"],
  cobranca: ["view_services", "refund_payments"],
  contactos: ["view_customers", "view_marketing"],
  suporte: ["view_support"],
  tecnicos: ["manage_technicians", "view_technicians"],
  financas: ["view_finance"],
  pagarTecnicos: ["pay_technicians"],
  sistema: ["manage_settings"],
  marketing: ["view_marketing"],
  mercado: ["view_services", "view_technicians"],
};

/**
 * "hoje às 09:00", "ontem às 18:30", "13/10 às 09:00", em Lisboa. Chegava
 * "2026-10-15 09:00" tal e qual, que nem se lê bem nem o Safari sabe ler como
 * data.
 */
export function quandoEmLisboa(iso: string, agoraMs: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const dia = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
  const hora = new Date(t).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });
  if (dia(t) === dia(agoraMs)) return `hoje às ${hora}`;
  if (dia(t) === dia(agoraMs - 86_400_000)) return `ontem às ${hora}`;
  const [, mes, d] = dia(t).split("-");
  return `${d}/${mes} às ${hora}`;
}

/** "8 min", "3 h", "2 dias". */
function duracao(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "dia" : "dias"}`;
}

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
  // Pedidos parados (backend #172).
  tecnico_nao_chegou: { titulo: "o técnico ainda não chegou", accao: "Passou meia hora da hora marcada: ligar ao técnico; se não aparecer, dar como falta." },
  em_execucao_ha_muito: { titulo: "está em curso há mais de 8 horas", accao: "Confirmar com o técnico se o trabalho já terminou." },
  cliente_sem_resposta: { titulo: "o cliente não responde há mais de um dia", accao: "Ligar ao cliente: pode estar com dificuldades a pagar ou a decidir.", doCliente: true },
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
    extra: { donos?: Permission[]; lembrete?: boolean; prazo?: string } = {},
  ): DashboardAlert => ({
    id, type, priority, title, description, createdAt,
    status: "novo", recommendedAction, entityType, entityId, ...extra,
  });

  // --- Leads por responder -------------------------------------------------
  // Uma a uma, não agregadas: cada lead é um contacto concreto à espera, e
  // agregá-las esconderia a mais antiga no meio das outras.
  for (const l of s.leadsPorResponder) {
    const ms = agoraMs - Date.parse(l.recebidaEm);
    const dias = diasEntre(l.recebidaEm, agoraMs);
    if (dias < LIMITES.leadDiasAlerta) continue;
    // Quem pediu urgência quer resposta em minutos, não no próprio dia.
    if (l.urgente) {
      alertas.push(novo(
        `lead-sem-resposta-${l.id}`,
        "marketing",
        ms >= LIMITES.leadUrgenteMinutos * 60_000 ? "critica" : "alta",
        `Contacto urgente por responder${ms >= 60_000 ? ` há ${duracao(ms)}` : ""}`,
        `${l.nome} pediu urgência e continua no estado "Novo".`,
        "Ligar já: pediu urgência.",
        l.recebidaEm, "lead", l.id, { donos: DONOS.contactos },
      ));
      continue;
    }
    alertas.push(novo(
      `lead-sem-resposta-${l.id}`,
      "marketing",
      dias >= LIMITES.leadDiasCritico ? "critica" : "alta",
      dias === 0 ? "Lead nova por responder" : `Lead sem resposta há ${plural(dias, "dia", "dias")}`,
      `${l.nome} pediu contacto e continua no estado "Novo".`,
      "Abrir o contacto e responder, ou perguntar a técnicos.",
      l.recebidaEm, "lead", l.id, { donos: DONOS.contactos },
    ));
  }

  // --- Pedidos com alerta nas Operações ao vivo ----------------------------
  // Um por pedido: são pedidos concretos, com cliente e prazo. A urgência é a
  // do Laravel, mas quando a bola está do lado do cliente não passa de média.
  for (const p of s.pedidosComAlerta ?? []) {
    if (p.nivel === "info") continue;
    // A cobrança que falhou volta a tentar-se sozinha: dá-se-lhe meia hora.
    if (p.motivo === "pagamento_por_capturar" && p.estadoDesde
      && agoraMs - Date.parse(p.estadoDesde) < LIMITES.capturaMinutos * 60_000) continue;
    const m = ACAO_DO_MOTIVO[p.motivo] ?? { titulo: p.motivo.replace(/_/g, " "), accao: "Abrir o pedido." };
    const prioridade: AlertPriority = m.doCliente ? "media" : p.nivel === "critico" ? "critica" : "alta";
    alertas.push(novo(
      `pedido-${p.motivo}-${p.id}`,
      "operacional",
      prioridade,
      `Pedido #${p.id}: ${m.titulo}`,
      [p.cliente, p.tipo, p.cidade].filter(Boolean).join(" · ") || "Pedido sem detalhe",
      m.accao,
      p.estadoDesde ?? p.desde ?? new Date(agoraMs).toISOString(), "pedido", p.id,
      { donos: p.motivo === "pagamento_por_capturar" ? DONOS.cobranca : DONOS.operacao, prazo: p.prazo ?? undefined },
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
      p.criadoEm, "pedido", p.id, { donos: DONOS.operacao },
    ));
  }

  // --- Faltas ---------------------------------------------------------------
  // A começar já e o técnico ainda não saiu: crítica, porque a janela para
  // ligar e salvar é de minutos. O prazo é a hora de início, e põe-na à frente
  // da fila (ver ordemDosAlertas). Era "alta" e ordenava-se pela data, que está
  // no futuro: ia parar ao fim, fora do "Precisa de ti" (simulação de 15/10).
  for (const f of s.faltasIminentes ?? []) {
    const hora = new Date(f.comecaEm).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });
    alertas.push(novo(
      `falta-iminente-${f.servicoId}`,
      "operacional",
      "critica",
      `Pedido #${f.servicoId} começa às ${hora} e o técnico ainda não saiu`,
      `${f.tecnico ?? "O técnico"} não marcou "a caminho"${f.cliente ? ` · cliente ${f.cliente}` : ""}.`,
      "Ligar ao técnico para confirmar que vai.",
      f.comecaEm, "pedido", f.servicoId, { donos: DONOS.operacao, prazo: f.comecaEm },
    ));
  }
  // Já passou da hora e não começou: crítica, há um cliente em casa à espera.
  for (const f of s.faltasProvaveis ?? []) {
    alertas.push(novo(
      `falta-${f.servicoId}`,
      "operacional",
      "critica",
      `Possível falta no pedido #${f.servicoId}`,
      `${f.tecnico ?? "O técnico"} ainda não começou${f.marcadoPara ? ` (estava marcado para ${quandoEmLisboa(f.marcadoPara, agoraMs)})` : ""}${f.cliente ? ` · cliente ${f.cliente}` : ""}.`,
      "Ligar ao técnico; se não aparecer, dar como falta em Técnicos › Qualidade › Faltas.",
      // O prazo é a hora marcada, que já passou: vem à frente de tudo o resto.
      f.marcadoPara ?? new Date(agoraMs).toISOString(), "pedido", f.servicoId,
      { donos: DONOS.operacao, prazo: f.marcadoPara ?? undefined },
    ));
  }

  // --- Cidades sem oferta ----------------------------------------------------
  // Houve quem pedisse e não há ninguém do outro lado: é onde se perdem pedidos.
  for (const c of s.cidadesSemOferta ?? []) {
    alertas.push(novo(
      `cidade-sem-oferta-${c.cidade.toLowerCase().replace(/\s+/g, "-")}`,
      "operacional",
      "alta",
      `${c.cidade}: ${plural(c.pedidos, "pedido", "pedidos")} e nenhum técnico online`,
      "Nas últimas 24 h houve procura nesta cidade e ninguém do lado da oferta.",
      "Abrir Mercado › Cobertura e ativar ou recrutar técnicos da zona.",
      new Date(agoraMs).toISOString(), "mercado", c.cidade, { donos: DONOS.mercado },
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
      "Aprovar em Financeiro › Transferências.",
      l.criadoEm, "lotes", l.id, { donos: DONOS.pagarTecnicos },
    ));
  }

  // --- Integrações paradas -------------------------------------------------
  // As do painel: falharam (duas vezes seguidas) ou deixaram de correr quando deviam.
  for (const i of s.integracoes ?? []) {
    if (i.estado === "falha" && i.falhasSeguidas < 2) continue;
    alertas.push(novo(
      `cron-${i.job}`,
      "produto",
      "alta",
      i.estado === "atrasado"
        ? `Integração "${i.nome}" não corre desde ${i.quando ? new Date(i.quando).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "há muito"}`
        : `Integração "${i.nome}" falhou ${plural(i.falhasSeguidas, "vez seguida", "vezes seguidas")}`,
      i.detalhe.slice(0, 200) || "Sem detalhe.",
      "Ver Produto › Integrações para o erro completo.",
      i.quando ?? new Date(agoraMs).toISOString(), "integracao", i.job, { donos: DONOS.sistema },
    ));
  }
  // As outras (sem horário conhecido): 3 falhas seguidas é avaria.
  for (const c of s.cronsFalhados) {
    if (c.falhasSeguidas < LIMITES.cronFalhasSeguidas) continue;
    alertas.push(novo(
      `cron-${c.job}`,
      "produto",
      "alta",
      `Integração "${c.job}" falhou ${plural(c.falhasSeguidas, "vez seguida", "vezes seguidas")}`,
      c.ultimoErro.slice(0, 200),
      "Ver Produto › Integrações para o erro completo.",
      c.ultimaTentativa, "integracao", c.job, { donos: DONOS.sistema },
    ));
  }

  // --- Suporte ----------------------------------------------------------------
  for (const t of s.ticketsAbertos) {
    // Uma reclamação conta desde que foi aberta: mesmo respondida, por resolver é um cliente insatisfeito.
    if (/reclama/i.test(t.categoria ?? "")) {
      const desde = t.abertoEm ?? t.desde;
      const ms = agoraMs - Date.parse(desde);
      if (ms < LIMITES.reclamacaoHoras * 3_600_000) continue;
      alertas.push(novo(
        `reclamacao-${t.id}`,
        "operacional",
        ms >= 72 * 3_600_000 ? "critica" : "alta",
        `Reclamação por resolver há ${duracao(ms)}`,
        `${t.assunto} · ${t.canal}`,
        "Abrir o ticket e resolver com o cliente.",
        desde, "ticket", t.id, { donos: DONOS.suporte },
      ));
      continue;
    }
    // Se a última mensagem é nossa, a bola está do lado do cliente: não é alerta.
    if (t.esperaResposta === false) continue;
    const ms = agoraMs - Date.parse(t.desde);
    const limite = LIMITES.ticketHoras[t.prioridade ?? "media"] ?? LIMITES.ticketHoras.media;
    if (ms < limite * 3_600_000) continue;
    alertas.push(novo(
      `ticket-${t.id}`,
      "operacional",
      t.prioridade === "critica" || ms >= 72 * 3_600_000 ? "critica" : "alta",
      `Ticket ${t.prioridade === "critica" ? "crítico " : ""}sem resposta há ${duracao(ms)}`,
      `${t.assunto} · ${t.canal}`,
      "Responder em Suporte › Tickets.",
      t.desde, "ticket", t.id, { donos: DONOS.suporte },
    ));
  }

  // --- Fila de KYC ---------------------------------------------------------
  // Só o que espera há mais de um dia (quando se sabe a data); senão, a fila toda.
  // A bola é NOSSA: um técnico com documentos por aprovar não pode trabalhar.
  // Por isso o que espera há mais de 24 h é "alta" (Tratar hoje), seja um ou
  // sejam dez. Estava em "A acompanhar · depende de terceiros", que é o
  // contrário (15/10/2026). Sem datas, só a fila grande sobe.
  const antigos = s.documentosAntigos;
  if (antigos ? antigos.quantos > 0 : s.documentosPendentes >= LIMITES.documentosPendentes) {
    const n = antigos ? antigos.quantos : s.documentosPendentes;
    alertas.push(novo(
      "kyc-fila",
      "equipa",
      antigos || s.documentosPendentes >= LIMITES.documentosPendentesAlta ? "alta" : "media",
      antigos
        ? `${plural(n, "documento de técnico", "documentos de técnicos")} à espera há mais de 24 h`
        : `${plural(n, "documento de técnico", "documentos de técnicos")} por aprovar`,
      antigos && s.documentosPendentes > n
        ? `${s.documentosPendentes} por rever no total. Técnicos à espera de aprovação não podem aceitar serviços.`
        : "Técnicos à espera de aprovação não podem aceitar serviços.",
      "Rever em Técnicos › Aprovações e KYC.",
      antigos?.maisAntigo ?? new Date(agoraMs).toISOString(), "kyc", undefined, { donos: DONOS.tecnicos },
    ));
  }

  // --- Faturas de custos vencidas (lembrete de gestão: fica no Financeiro) --
  for (const f of s.faturasVencidas) {
    const dias = diasEntre(f.venceuEm, agoraMs);
    alertas.push(novo(
      `fatura-vencida-${f.fornecedor}-${f.venceuEm}`,
      "financeiro",
      dias >= 15 ? "critica" : "alta",
      `Fatura de ${f.fornecedor} vencida há ${plural(Math.max(dias, 1), "dia", "dias")}`,
      `${f.valorEmDivida.toFixed(2).replace(".", ",")} € em dívida — atrasos estragam a relação com fornecedores.`,
      "Registar o pagamento em Financeiro › Faturas de custos.",
      f.venceuEm, "fatura", undefined, { donos: DONOS.financas, lembrete: true },
    ));
  }

  // --- Obrigações fiscais vencidas (lembrete de gestão) -----------------------
  // Sempre críticas: prazos fiscais falhados geram coimas, não conversas.
  for (const i of s.impostosVencidos) {
    alertas.push(novo(
      `imposto-vencido-${i.nome}-${i.venceuEm}`,
      "fiscal",
      "critica",
      `${i.nome} com prazo ultrapassado`,
      `${i.valor.toFixed(2).replace(".", ",")} €${i.estimado ? " (estimativa)" : ""} · prazo era ${i.venceuEm.slice(0, 10)}.`,
      "Confirmar o pagamento em Financeiro › Resultado › Impostos e RH.",
      i.venceuEm, "imposto", undefined, { donos: DONOS.financas, lembrete: true },
    ));
  }

  // --- Recolha de anúncios parada (lembrete de gestão: fica no Marketing) ---
  if (s.diasSemDadosDeAnuncios !== null && s.diasSemDadosDeAnuncios > LIMITES.diasSemAnuncios) {
    alertas.push(novo(
      "anuncios-parados",
      "marketing",
      "media",
      `Sem dados de anúncios há ${plural(s.diasSemDadosDeAnuncios, "dia", "dias")}`,
      "Pode ser recolha avariada ou campanhas paradas — o Marketing não distingue sozinho.",
      "Carregar em \"Atualizar anúncios\" no Marketing e ler a mensagem.",
      new Date(agoraMs).toISOString(), "marketing", undefined, { donos: DONOS.marketing, lembrete: true },
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
      "Ver Financeiro › Pagamentos.",
      new Date(agoraMs).toISOString(), "pagamentos", undefined, { donos: DONOS.financas },
    ));
  }

  // Mais urgente primeiro; dentro da mesma urgência, o prazo mais curto e
  // depois o mais antigo (ver ordemDosAlertas).
  return ordenarAlertas(alertas);
}
