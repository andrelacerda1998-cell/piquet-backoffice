/** As categorias de um ticket aberto pela equipa (as apps mandam texto livre). */
export const CATEGORIAS_DO_TICKET = ["Reclamação", "Pagamento", "Técnico", "Outro"] as const;

/** Os graus de importância, pela ordem em que se escolhem. */
export const PRIORIDADES_DO_TICKET = [
  { id: "baixa", label: "Baixa" },
  { id: "media", label: "Média" },
  { id: "alta", label: "Alta" },
  { id: "critica", label: "Crítica" },
] as const;

/** O estado de um ticket, como se lê (mesmo vocabulário da caixa de Suporte). */
export const ESTADOS_DO_TICKET: Record<string, string> = {
  novo: "Novo",
  em_curso: "Em curso",
  aguarda_cliente: "À espera do cliente",
  resolvido: "Resolvido",
  fechado: "Fechado",
};
