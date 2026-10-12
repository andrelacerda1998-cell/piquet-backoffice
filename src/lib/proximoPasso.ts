import type { EventoDoPedido } from "@/lib/historicoPedido";
import type { ServiceStatus } from "@/types";

/**
 * "Próximo passo": uma frase, calculada a partir do estado e dos tempos, que
 * diz o que fazer com um pedido -- ou que não há nada a fazer. É o que a
 * auditoria de 08/10/2026 pedia para o cimo da ficha: quem abre um pedido não
 * precisa de saber o que é `a_aguardar_confirmacao`, precisa de saber se tem
 * de ligar a alguém.
 *
 * Função pura (o relógio entra como argumento), para se poder testar cada caso.
 */

export type AcaoSugerida = "ligar_cliente" | "ligar_tecnico" | "despachar" | "fechar" | "tentar_cobrar" | "ver_ticket";

export interface ProximoPasso {
  texto: string;
  /** `agir`: alguém da equipa tem de fazer algo; `esperar`: está a andar sozinho. */
  tom: "agir" | "esperar";
  acao?: AcaoSugerida;
}

export interface DadosDoPedido {
  status: ServiceStatus;
  /** O estado no Laravel ("Finished"…), mais fino do que o do backoffice. */
  estadoLaravel?: string | null;
  pedidoEm?: string | null;
  marcadoPara?: string | null;
  /** Quando o técnico começou e quando terminou (para pedidos sem histórico, antes de 08/10/2026). */
  iniciadoEm?: string | null;
  terminadoEm?: string | null;
  temTecnico: boolean;
  personalizado?: boolean;
  temReclamacao?: boolean;
  /** Os convites do matching: quantos, quantos aceitaram, quantos ainda podem responder. */
  convidados?: { total: number; aceitaram: number; porResponder: number } | null;
  /** O histórico do pedido, para saber desde quando está no estado atual. */
  eventos?: readonly EventoDoPedido[];
}

const MIN = 60_000;
const HORA = 60 * MIN;

/** Limites, com nome: são as regras que a equipa vai querer afinar. */
export const LIMITES = {
  /** Um pedido perdido recupera-se ligando depressa; depois de um dia já não. */
  perdidoRecuperavel: 24 * HORA,
  /** O técnico devia ter chegado: passou da hora marcada. */
  atrasoAoInicio: 15 * MIN,
  /** Começa já: vale a pena confirmar que o técnico vai a caminho. */
  comecaEmBreve: 60 * MIN,
  /** À espera de o cliente pagar há tempo demais. */
  pagamentoParado: 30 * MIN,
  /** No local há tempo demais para um serviço ao domicílio. */
  emCursoDemasiado: 8 * HORA,
  /** O técnico terminou e o cliente não confirmou: a partir daqui fecha-se. */
  semConfirmacao: 24 * HORA,
} as const;

/** "há 4 min", "há 2 h", "há 3 dias". */
export function haQuanto(desdeMs: number, agoraMs: number): string {
  const ms = Math.max(0, agoraMs - desdeMs);
  if (ms < HORA) return `há ${Math.max(1, Math.round(ms / MIN))} min`;
  if (ms < 24 * HORA) return `há ${Math.round(ms / HORA)} h`;
  const d = Math.round(ms / (24 * HORA));
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** "14:00" se for hoje, "sex, 14:00" se não. */
function quando(iso: string, agoraMs: number): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });
  const mesmoDia = d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" })
    === new Date(agoraMs).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
  if (mesmoDia) return `hoje às ${hora}`;
  const dia = d.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Lisbon" });
  return `${dia.replace(".", "")} às ${hora}`;
}

/** Desde quando o pedido está no estado em que está (o último evento que o pôs lá). */
export function desdeQuando(d: DadosDoPedido): number | null {
  const eventos = (d.eventos ?? []).filter((e) => e.tipo === "estado" || e.tipo === "criado");
  const ultimo = [...eventos].sort((a, b) => Date.parse(b.em) - Date.parse(a.em))[0];
  // Sem histórico, a melhor hora que há para o estado em que está; só no fim a do pedido.
  const doEstado = d.status === "em_execucao" ? d.iniciadoEm : d.status === "a_aguardar_confirmacao" ? d.terminadoEm : null;
  const iso = ultimo?.em ?? doEstado ?? d.pedidoEm;
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
}

const temHora = (iso?: string | null) => !!iso && iso.length > 10;

export function proximoPasso(d: DadosDoPedido, agoraMs: number): ProximoPasso | null {
  const desde = desdeQuando(d);
  const ha = desde != null ? haQuanto(desde, agoraMs) : null;
  const passou = (ms: number) => desde != null && agoraMs - desde > ms;
  const laravel = d.estadoLaravel ?? null;

  if (d.temReclamacao || d.status === "em_reclamacao") {
    return { texto: "Há uma reclamação deste pedido. Responde ao cliente no ticket.", tom: "agir", acao: "ver_ticket" };
  }

  switch (d.status) {
    case "a_aguardar_orcamento":
      if (d.personalizado || laravel === "PendingReview") {
        return {
          texto: `Pedido personalizado à espera da Piquet${ha ? ` ${ha}` : ""}. Define a duração e as categorias e despacha-o.`,
          tom: "agir", acao: "despachar",
        };
      }
      return { texto: "À espera do orçamento do técnico.", tom: "esperar" };

    case "pedido_recebido":
    case "a_procurar_tecnico": {
      const c = d.convidados;
      if (!c || c.total === 0) {
        return passou(10 * MIN)
          ? { texto: `À procura ${ha} e ainda ninguém foi convidado: pode não haver técnicos perto. Liga ao cliente.`, tom: "agir", acao: "ligar_cliente" }
          : { texto: "A procurar técnico. O sistema está a convidar os mais próximos.", tom: "esperar" };
      }
      if (c.aceitaram > 0) return { texto: `${c.aceitaram} ${c.aceitaram === 1 ? "técnico aceitou" : "técnicos aceitaram"}: falta o cliente escolher.`, tom: "esperar" };
      if (c.porResponder > 0) {
        return { texto: `${c.porResponder} de ${c.total} ${c.total === 1 ? "convidado" : "convidados"} ainda podem responder. Nada a fazer por agora.`, tom: "esperar" };
      }
      return { texto: `Os ${c.total} convidados recusaram ou não responderam. Liga ao cliente antes que desista.`, tom: "agir", acao: "ligar_cliente" };
    }

    case "sem_tecnico_disponivel":
      if (desde != null && agoraMs - desde < LIMITES.perdidoRecuperavel) {
        return { texto: `Acabou sem técnico ${ha}. Liga ao cliente nos próximos minutos: ainda dá para o recuperar.`, tom: "agir", acao: "ligar_cliente" };
      }
      return null;

    case "tecnico_encontrado":
    case "pago":
    case "agendado": {
      if (!d.marcadoPara) return { texto: "Com técnico. À espera de que saia para o local.", tom: "esperar" };
      const inicio = Date.parse(d.marcadoPara);
      if (!Number.isFinite(inicio)) return null;
      if (temHora(d.marcadoPara) && agoraMs - inicio > LIMITES.atrasoAoInicio) {
        return {
          texto: `Devia ter começado ${haQuanto(inicio, agoraMs)} e o técnico ainda não chegou. Liga-lhe para saber se vai.`,
          tom: "agir", acao: "ligar_tecnico",
        };
      }
      if (temHora(d.marcadoPara) && inicio - agoraMs <= LIMITES.comecaEmBreve && inicio >= agoraMs) {
        return { texto: `Começa ${quando(d.marcadoPara, agoraMs)}. Se o técnico não marcar "a caminho", liga-lhe.`, tom: "esperar" };
      }
      return { texto: `Marcado para ${temHora(d.marcadoPara) ? quando(d.marcadoPara, agoraMs) : new Date(inicio).toLocaleDateString("pt-PT")}. Nada a fazer até lá.`, tom: "esperar" };
    }

    case "orcamento_enviado":
    case "a_aguardar_pagamento":
      if (passou(LIMITES.pagamentoParado)) {
        return { texto: `À espera do cliente ${ha}. Se não avançar, liga-lhe: pode estar com dificuldades a pagar.`, tom: "agir", acao: "ligar_cliente" };
      }
      return { texto: `À espera do cliente${ha ? ` (${ha})` : ""}.`, tom: "esperar" };

    case "em_execucao":
      if (passou(LIMITES.emCursoDemasiado)) {
        return { texto: `O técnico está no local ${ha}. Confirma com ele se o trabalho já terminou.`, tom: "agir", acao: "ligar_tecnico" };
      }
      return { texto: `O técnico está no local${ha ? ` (chegou ${ha})` : ""}.`, tom: "esperar" };

    case "a_aguardar_confirmacao":
      if (passou(LIMITES.semConfirmacao)) {
        return {
          texto: `O técnico terminou ${ha} e o cliente não confirmou. Liga ao cliente; se estiver tudo bem, fecha e cobra.`,
          tom: "agir", acao: "fechar",
        };
      }
      return { texto: `O técnico terminou${ha ? ` ${ha}` : ""}. Falta o cliente confirmar na app.`, tom: "esperar" };

    case "pagamento_por_capturar":
      return {
        texto: `O trabalho está feito mas a cobrança falhou${ha ? ` (${ha})` : ""}. Tenta cobrar de novo; se voltar a falhar, liga ao cliente.`,
        tom: "agir", acao: "tentar_cobrar",
      };

    default:
      // Concluído e cancelado: não há nada a fazer.
      return null;
  }
}
