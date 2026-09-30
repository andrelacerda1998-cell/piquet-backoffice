import { formatCurrency } from "./formatters";
import type { Pendente } from "./avisosPendentes";

/**
 * Avisos do que ACONTECE, e não do que está à espera.
 *
 * Os avisos que já existiam (tickets, pedidos) são uma fila: ficam lá até
 * alguém lhes tocar. Um serviço concluído não é uma fila -- é um facto, que
 * acontece uma vez e não volta a acontecer.
 *
 * Isso muda duas coisas.
 *
 * Primeiro, o id inclui o estado (`servico:282:concluido`), porque o mesmo
 * serviço é avisado duas vezes na vida: quando fica agendado e quando fica
 * concluído. Com o id só do serviço, o segundo aviso nunca saía.
 *
 * Segundo, é preciso uma JANELA. Sem ela, a primeira vez que isto corre
 * anuncia todos os serviços concluídos desde sempre -- centenas -- e o que
 * devia ser um aviso vira um despejo.
 */

/** O que estes avisos precisam de saber de um serviço. */
export interface ServicoParaAviso {
  id: string;
  status: string;
  /** Não entra no aviso — fica por ser o que a fonte devolve. */
  customerName?: string;
  serviceName?: string;
  city?: string;
  totalCustomerValue: number;
  scheduledAt?: string;
  completedAt?: string;
  requestedAt?: string;
}

/** O que estes avisos precisam de saber de um documento submetido. */
export interface DocumentoParaAviso {
  id: string | number;
  vendorName?: string | null;
  documentType?: string | null;
  status: string;
  createdAt?: string | null;
}

/**
 * Estados em que uma marcação já não interessa: o serviço acabou ou morreu.
 *
 * Sem isto, um serviço concluído que tinha sido marcado para amanhã ainda
 * avisava "agendado" depois de já estar feito.
 */
const ESTADOS_MORTOS = new Set([
  "concluido", "cancelado_cliente", "cancelado_tecnico", "reembolsado", "sem_tecnico_disponivel",
]);

/**
 * O valor, como ele aparece no aviso.
 *
 * Zero não é "grátis", é "ainda não se sabe": um serviço agendado pode estar
 * à espera de orçamento. Escrever "0,00 €" ali seria dizer uma coisa falsa
 * sobre dinheiro, que é o pior sítio para se enganar alguém.
 */
export function valorDoAviso(total: number): string {
  return total > 0 ? formatCurrency(total) : "valor por definir";
}

/**
 * Há uma marcação que ainda interessa avisar?
 *
 * "Agendado" NÃO É UM ESTADO nos dados. O Laravel traduz onze estados
 * (Pending, Matching, Accepted, Closed, ...) e nenhum deles dá "agendado" --
 * o que não estiver no mapa cai em "pedido_recebido" em silêncio. Filtrar por
 * `status === "agendado"` era procurar uma coisa que nunca aparece, e o aviso
 * de agendamento nunca podia disparar. Só se deu por isso ao pôr o cron a
 * contar: "agendados 0" em 250 serviços.
 *
 * O agendamento existe é como DATA (`scheduled_at`). É por ela que se vê.
 *
 * E a janela aqui não pode ser a mesma: uma marcação feita hoje para daqui a
 * duas semanas ficava de fora de uma janela de 48h. Interessa qualquer data
 * no futuro -- e também as das últimas horas, para não se perder uma marcação
 * para hoje de manhã vista ao meio-dia.
 */
function temMarcacaoRelevante(s: ServicoParaAviso, agora: Date, janelaHoras: number): boolean {
  if (!s.scheduledAt || ESTADOS_MORTOS.has(s.status)) return false;
  const t = new Date(s.scheduledAt).getTime();
  if (Number.isNaN(t)) return false;
  return t >= agora.getTime() - janelaHoras * 3600_000;
}

/** Dia e hora curtos, à portuguesa. */
function marcacao(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Lisbon",
  }).format(d);
}

function dentroDaJanela(iso: string | undefined, agora: Date, horas: number): boolean {
  /*
    Sem data não se sabe se aconteceu agora ou há um ano, e na dúvida não se
    avisa: um aviso a horas erradas custa mais do que um aviso que falta.
  */
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const idade = agora.getTime() - t;
  // Agendamentos são no FUTURO: a janela tem de contar dos dois lados.
  return Math.abs(idade) <= horas * 3600_000;
}

/**
 * Serviços concluídos e agendados, como avisos.
 *
 * O título leva o estado e o valor porque é o título que sobrevive ao
 * agrupamento: quando há várias coisas novas, a notificação mostra só os
 * títulos. Se o valor fosse para o corpo, desaparecia justamente nos dias
 * com movimento.
 */
export function avisosDeServicos(
  servicos: ServicoParaAviso[],
  { agora = new Date(), janelaHoras = 48 }: { agora?: Date; janelaHoras?: number } = {},
): Pendente[] {
  const saida: Pendente[] = [];

  /*
    O corpo leva o tipo de serviço e a cidade, e NÃO o nome do cliente.

    Numa notificação cabem poucas palavras antes de serem cortadas, e o nome
    de quem pediu não ajuda a decidir nada de relance -- "Reparação de
    canalização | Porto" diz o que aconteceu e onde. Quem foi descobre-se ao
    tocar, que é para onde o aviso leva.

    Barra a separar serviço de cidade, ponto médio a separar o dia e a hora:
    dois separadores diferentes para duas coisas diferentes, senão
    "Eletricidade | Lisboa | 1/10" lê-se como três campos do mesmo tipo.
  */
  const aviso = (s: ServicoParaAviso, estado: "concluido" | "agendado", marca = ""): Pendente => {
    const partes = [s.serviceName, s.city].map((x) => x?.trim()).filter(Boolean);
    return {
      id: `servico:${s.id}:${estado}`,
      titulo: `Serviço ${estado === "concluido" ? "concluído" : "agendado"} · ${valorDoAviso(s.totalCustomerValue)}`,
      corpo: [partes.join(" | "), marca].filter(Boolean).join(" · ") || `Serviço ${s.id}`,
      url: `/servicos?servico=${s.id}`,
    };
  };

  for (const s of servicos) {
    // Concluído: pelo estado, que aqui existe mesmo (Closed/Finished).
    if (s.status === "concluido" && dentroDaJanela(s.completedAt ?? s.requestedAt, agora, janelaHoras)) {
      saida.push(aviso(s, "concluido"));
    }

    // Agendado: pela DATA marcada, não pelo estado. Ver temMarcacaoRelevante.
    if (temMarcacaoRelevante(s, agora, janelaHoras)) {
      saida.push(aviso(s, "agendado", marcacao(s.scheduledAt!)));
    }
  }

  return saida;
}

/**
 * Documentos que os técnicos submeteram e ainda ninguém viu.
 *
 * Aqui a janela é maior porque isto SIM é uma fila: um documento por validar
 * continua por validar no dia seguinte, e vale a pena voltar a lembrar. A
 * memória dos avisos é que trata de não repetir.
 */
export function avisosDeDocumentos(
  documentos: DocumentoParaAviso[],
  { agora = new Date(), janelaDias = 7 }: { agora?: Date; janelaDias?: number } = {},
): Pendente[] {
  return documentos
    .filter((d) => d.status === "pending")
    .filter((d) => dentroDaJanela(d.createdAt ?? undefined, agora, janelaDias * 24))
    .map((d) => ({
      id: `documento:${d.id}`,
      titulo: "Documento de técnico por validar",
      corpo: [d.vendorName?.trim(), d.documentType?.trim()].filter(Boolean).join(" — ")
        || `Documento ${d.id}`,
      url: `/tecnicos?documento=${d.id}`,
    }));
}

/**
 * A data do último serviço concluído e do último agendado.
 *
 * Serve para distinguir duas situações que, vistas de fora, são idênticas:
 * "não há avisos porque não aconteceu nada" e "não há avisos porque a
 * tradução dos estados do Laravel está errada e nada é reconhecido como
 * concluído". Sem isto, a única saída era abrir o ecrã e comparar à mão.
 */
export function ultimasDatas(servicos: ServicoParaAviso[]): {
  concluido: string | null;
  agendado: string | null;
  /** Quantos serviços têm cada um destes estados, no total lido. */
  contagem: { concluido: number; agendado: number };
} {
  let concluido: string | null = null;
  let agendado: string | null = null;
  const contagem = { concluido: 0, agendado: 0 };

  const maisRecente = (a: string | null, b: string | undefined | null): string | null => {
    if (!b) return a;
    const t = new Date(b).getTime();
    if (Number.isNaN(t)) return a;
    return a === null || t > new Date(a).getTime() ? b : a;
  };

  for (const s of servicos) {
    if (s.status === "concluido") {
      contagem.concluido++;
      concluido = maisRecente(concluido, s.completedAt ?? s.requestedAt);
    }
    /*
      Conta pela DATA e não pelo estado, pela mesma razão que os avisos: não
      existe estado "agendado" nos dados. Enquanto contou pelo estado, esta
      linha dizia "agendados 0" com 250 serviços lidos -- e foi assim que o
      problema apareceu.
    */
    if (s.scheduledAt && !ESTADOS_MORTOS.has(s.status)) {
      contagem.agendado++;
      agendado = maisRecente(agendado, s.scheduledAt);
    }
  }

  return { concluido, agendado, contagem };
}

/** O que estes avisos precisam de saber de um técnico. */
export interface TecnicoParaAviso {
  id: number | string;
  nome?: string | null;
  /** Subutilizador da AT, no formato `NIF/subutilizador`. */
  atUser?: string | null;
  /** Workspace de faturação. Vazio ou nulo = ainda não foi criado. */
  invoiceWorkspace?: string | null;
  /** Código do que falta antes de se poder criar. `null` = nada falta. */
  blocker?: string | null;
}

/**
 * Técnicos que já entregaram o subutilizador da AT e estão à espera que lhes
 * criem o workspace de faturação.
 *
 * O workspace NÃO é criado pelo técnico: é a equipa da Piquet que o cria no
 * backoffice. Enquanto não for criado, o técnico não pode ficar online --
 * `canAcceptService` exige `invoice_workspace != null`. Ou seja, ele faz a
 * parte dele, e depois fica parado à espera de alguém, sem que esse alguém
 * saiba que está à espera. É o mesmo buraco dos documentos submetidos.
 *
 * Três condições, e as três importam:
 *
 * O `at_user` tem de ter uma barra. É o formato do subutilizador
 * (`NIF/nome`), e é o que `canAcceptService` exige do lado do Laravel -- um
 * campo preenchido com o NIF sozinho está por acabar, não por validar.
 *
 * O workspace tem de estar por criar, senão avisava-se de trabalho já feito.
 *
 * E não pode haver bloqueio. "Já dá para validar" é literal: se ainda faltam
 * documentos, IBAN ou morada fiscal, o botão de criar está desligado e o
 * aviso só mandava alguém dar de caras com ele.
 *
 * A condição vive em `esperaPeloWorkspace` e não aqui dentro porque o ecrã de
 * Técnicos mostra a MESMA lista. Duas cópias da regra divergiriam ao primeiro
 * ajuste, e o resultado seria um aviso a apontar para um ecrã vazio -- ou o
 * contrário. Já aconteceu neste projeto com a urgência dos pedidos.
 */
export function esperaPeloWorkspace(t: TecnicoParaAviso): boolean {
  return (t.atUser ?? "").includes("/") && !t.invoiceWorkspace && !t.blocker;
}

export function avisosDeWorkspace(tecnicos: TecnicoParaAviso[]): Pendente[] {
  return tecnicos
    .filter(esperaPeloWorkspace)
    .map((t) => ({
      id: `workspace:${t.id}`,
      titulo: "Workspace de faturação por criar",
      corpo: `${t.nome?.trim() || `Técnico ${t.id}`} já entregou o acesso à AT`,
      url: `/tecnicos?tecnico=${t.id}`,
    }));
}
