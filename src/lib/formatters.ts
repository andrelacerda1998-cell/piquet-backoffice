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

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    concluido: "bg-success-light text-success",
    pago: "bg-success-light text-success",
    ativo: "bg-success-light text-success",
    aprovado: "bg-success-light text-success",
    resolvido: "bg-success-light text-success",
    cancelado_cliente: "bg-danger-light text-danger",
    cancelado_tecnico: "bg-danger-light text-danger",
    reembolsado: "bg-danger-light text-danger",
    vencido: "bg-danger-light text-danger",
    critica: "bg-danger-light text-danger",
    em_execucao: "bg-piquet-100 text-piquet-700",
    agendado: "bg-blue-50 text-blue-700",
    a_procurar_tecnico: "bg-warning-light text-warning",
    sem_tecnico_disponivel: "bg-warning-light text-warning",
    em_reclamacao: "bg-warning-light text-warning",
    alta: "bg-warning-light text-warning",
    media: "bg-yellow-50 text-yellow-700",
    baixa: "bg-surface-subtle text-text-secondary",
    novo: "bg-blue-50 text-blue-700",
    em_analise: "bg-purple-50 text-purple-700",
    estimado: "bg-yellow-50 text-yellow-700",
    a_aguardar_pagamento: "bg-orange-50 text-orange-700",
  };
  return colors[status] ?? "bg-surface-subtle text-text-secondary";
}
