const currencyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("pt-PT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("pt-PT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPercent(value: number): string {
  return `${decimalFormatter.format(value)}%`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function formatChangePercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPercent(value)}`;
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return formatNumber(value);
}

export function getPeriodLabel(preset: string): string {
  const labels: Record<string, string> = {
    hoje: "Hoje",
    ontem: "Ontem",
    ultimos_7_dias: "Últimos 7 dias",
    ultimos_30_dias: "Últimos 30 dias",
    este_mes: "Este mês",
    mes_anterior: "Mês anterior",
    este_trimestre: "Este trimestre",
    este_ano: "Este ano",
    personalizado: "Período personalizado",
  };
  return labels[preset] ?? preset;
}

/**
 * Catálogo ÚNICO de estados do negócio → tom semântico. Fonte de verdade para
 * as cores de estado em TODO o backoffice (serviços, leads, faturas,
 * pagamentos, técnicos, clientes, prioridades, tickets…). Só tons do design
 * system (theme-aware, funcionam em claro e escuro) — sem Tailwind cru.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "active" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  info: "bg-info-light text-info",
  active: "bg-piquet/15 text-piquet-700",
  neutral: "bg-surface-subtle text-text-secondary",
};

const STATUS_TONE: Record<string, StatusTone> = {
  // Serviços (ciclo de vida)
  pedido_recebido: "info", a_procurar_tecnico: "warning", tecnico_encontrado: "info",
  a_aguardar_orcamento: "warning", orcamento_enviado: "info", a_aguardar_pagamento: "warning",
  pago: "success", agendado: "info", em_execucao: "active", concluido: "success",
  cancelado_cliente: "danger", cancelado_tecnico: "danger", sem_tecnico_disponivel: "warning",
  reembolsado: "warning", em_reclamacao: "warning",
  // Leads / CRM (os `id` mantêm-se; rótulos são Novo/…/Executado/Cancelado)
  nao_iniciado: "info", orcamento_aceite: "success", recusado: "danger",
  // Faturas de custos
  pendente: "warning", parcial: "info",
  // Pagamentos
  falhado: "danger",
  // Técnicos / clientes / candidaturas
  ativo: "success", aprovado: "success", resolvido: "success",
  suspenso: "danger", bloqueado: "danger", inativo: "neutral",
  em_analise: "info", registado: "info", perfil_incompleto: "warning",
  contrato_terminado: "neutral", por_validar: "warning", entrevista: "info",
  // Fiscal / faturação
  vencido: "danger", estimado: "warning", emitida: "success", nao_emitida: "neutral",
  // Prioridades
  critica: "danger", alta: "warning", media: "info", baixa: "neutral",
  // Genéricos
  novo: "info", ativa: "success", pausada: "neutral", concluida: "success",
};

/** Tom semântico de um estado (para casos que precisam do tom, não da classe). */
export function statusTone(status: string): StatusTone {
  return STATUS_TONE[status] ?? "neutral";
}

/** Classe de cor (theme-aware) de um estado — fonte única. */
export function getStatusColor(status: string): string {
  return TONE_CLASS[statusTone(status)];
}
