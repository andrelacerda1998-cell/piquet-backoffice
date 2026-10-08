/**
 * Operações ao vivo: os tipos que a API devolve e o que o ecrã faz com eles.
 * Ver GET /v1/admin/operacoes/ao-vivo no Laravel e /api/operacoes/ao-vivo.
 */
import type { ServiceStatus } from "@/types";

export type NivelAlerta = "critico" | "atencao" | "info";
export interface Alerta { nivel: NivelAlerta; motivo: string }
export type Modo = "imediato" | "agendado" | "personalizado";

export interface PedidoBase {
  id: string;
  estado: string;
  /** O estado no vocabulário do backoffice (acrescentado pela rota). */
  estadoBackoffice: ServiceStatus;
  modo: Modo;
  tipo: string | null;
  cliente: string | null;
  cidade: string | null;
  criado_em: string | null;
  marcado_para: string | null;
}

export interface PedidoAProcura extends PedidoBase {
  convidados: number;
  por_responder: number;
  aceitaram: number;
  recusaram: number;
  expiraram: number;
  onda: number;
  assincrono: boolean;
  prazo: string | null;
  prazo_de: "convites" | "cliente" | null;
  segundos_restantes: number | null;
  alerta: Alerta | null;
}

export interface PedidoEmCurso extends PedidoBase {
  tecnico: string | null;
  a_caminho_em: string | null;
  chegou_em: string | null;
  alerta: Alerta | null;
}

export type Desfecho =
  | "servido" | "sem_oferta" | "sem_resposta" | "sem_escolha"
  | "pagamento_falhou" | "cancelado" | "outro" | "em_aberto";

export interface Liquidez {
  dias: number;
  pedidos: number;
  terminados: number;
  com_sim: number;
  servidos: number;
  taxa_com_sim: number | null;
  taxa_servidos: number | null;
  mediana_segundos_ate_primeiro_sim: number | null;
  por_desfecho: Record<Desfecho, number>;
  por_modo: Partial<Record<Modo, { pedidos: number; servidos: number }>>;
}

export interface PedidoPerdido extends PedidoBase {
  convidados: number;
  desfecho: Desfecho;
  viveu_segundos: number | null;
}

export interface AoVivo {
  gerado_em: string;
  a_procura: PedidoAProcura[];
  em_curso: PedidoEmCurso[];
  oferta: {
    janela_minutos: number;
    online: number;
    podem_aceitar: number;
    prontos: number;
    por_area: Array<{ area_id: number | string; area: string; online: number; prontos: number }>;
  };
  liquidez: { "7d": Liquidez; "30d": Liquidez };
  perdidos: PedidoPerdido[];
}

/** O que cada alerta quer dizer, na língua de quem tem de agir. */
export const MOTIVOS: Record<string, string> = {
  personalizado_por_rever: "Personalizado à espera de revisão: define o tempo e as categorias para os convites saírem.",
  ninguem_convidado: "Ninguém foi convidado: não há técnicos disponíveis para este pedido.",
  ninguem_a_responder: "Ninguém está a responder: os convidados expiraram ou recusaram.",
  prazo_esgotado: "O prazo acabou: o pedido vai falhar a qualquer momento.",
  prazo_a_acabar: "O prazo está a acabar.",
  cliente_a_escolher: "Já há quem aceite: falta o cliente escolher e pagar.",
  pagamento_por_capturar: "Trabalho feito, mas o pagamento ficou por capturar.",
  cliente_nao_confirmou: "O técnico terminou há mais de 24 h e o cliente ainda não confirmou.",
};

export const DESFECHOS: Record<Desfecho, string> = {
  servido: "Servidos",
  sem_oferta: "Sem técnicos para convidar",
  sem_resposta: "Convidados não responderam",
  sem_escolha: "Cliente não escolheu ou não pagou",
  pagamento_falhou: "Pagamento falhou",
  cancelado: "Cancelados",
  outro: "Outros",
  em_aberto: "Ainda abertos",
};

export const MODOS: Record<Modo, string> = {
  imediato: "Agora",
  agendado: "Agendado",
  personalizado: "Personalizado",
};

const PESO: Record<NivelAlerta, number> = { critico: 0, atencao: 1, info: 2 };

/**
 * A fila: primeiro o que está a morrer, depois o que aperta, depois o resto.
 * Dentro do mesmo nível, o prazo mais curto primeiro; sem prazo, o mais antigo.
 */
export function ordenarPorUrgencia<T extends { alerta: Alerta | null; segundos_restantes?: number | null; criado_em: string | null }>(lista: readonly T[]): T[] {
  const peso = (p: T) => (p.alerta ? PESO[p.alerta.nivel] : 3);
  const restante = (p: T) => p.segundos_restantes ?? Infinity;
  const idade = (p: T) => (p.criado_em ? Date.parse(p.criado_em) : Infinity);
  return [...lista].sort((a, b) => peso(a) - peso(b) || restante(a) - restante(b) || idade(a) - idade(b));
}

/** "2 min 05 s", "1 h 20 min", "3 d 4 h". Negativo: "esgotado". */
export function duracao(segundos: number | null | undefined): string {
  if (segundos == null || !Number.isFinite(segundos)) return "—";
  if (segundos <= 0) return "esgotado";
  const s = Math.floor(segundos);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

/**
 * Quanto falta AGORA, a partir do que a API mediu quando respondeu. O ecrã
 * conta para baixo entre leituras sem voltar a perguntar ao servidor.
 */
export function restanteAgora(segundosNaLeitura: number | null, lidoEm: string, agora: number): number | null {
  if (segundosNaLeitura == null) return null;
  const passou = (agora - Date.parse(lidoEm)) / 1000;
  return Math.round(segundosNaLeitura - Math.max(0, passou));
}

/** Há quanto tempo, a partir de uma data ISO. */
export function haQuanto(iso: string | null, agora: number): string {
  if (!iso) return "—";
  return duracao((agora - Date.parse(iso)) / 1000);
}

/** Percentagem com vírgula; sem base, um traço — nunca um 0% inventado. */
export function pct(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1).replace(".", ",").replace(",0", "")}%`;
}
