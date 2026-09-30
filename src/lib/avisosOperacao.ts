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

/** Os dois estados que o André pediu, e o nome com que aparecem no aviso. */
const ESTADOS: Record<string, string> = {
  concluido: "concluído",
  agendado: "agendado",
};

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

/** A data a que o facto aconteceu, que é a que conta para a janela. */
function quando(s: ServicoParaAviso): string | undefined {
  if (s.status === "concluido") return s.completedAt ?? s.requestedAt;
  if (s.status === "agendado") return s.scheduledAt ?? s.requestedAt;
  return undefined;
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

  for (const s of servicos) {
    const estado = ESTADOS[s.status];
    if (!estado) continue;

    const data = quando(s);
    if (!dentroDaJanela(data, agora, janelaHoras)) continue;

    /*
      O corpo leva o tipo de serviço e a cidade, e NÃO o nome do cliente.

      Numa notificação cabem poucas palavras antes de serem cortadas, e o
      nome de quem pediu não ajuda a decidir nada de relance -- "Reparação de
      canalização — Porto" diz o que aconteceu e onde. Quem foi descobre-se
      ao tocar, que é para onde o aviso leva.
    */
    const partes = [s.serviceName, s.city].map((x) => x?.trim()).filter(Boolean);
    const marca = s.status === "agendado" && s.scheduledAt ? marcacao(s.scheduledAt) : "";

    saida.push({
      id: `servico:${s.id}:${s.status}`,
      titulo: `Serviço ${estado} · ${valorDoAviso(s.totalCustomerValue)}`,
      corpo: [partes.join(" — "), marca].filter(Boolean).join(" · ") || `Serviço ${s.id}`,
      url: `/servicos?servico=${s.id}`,
    });
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
