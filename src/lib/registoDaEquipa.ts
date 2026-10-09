/**
 * O que fica registado de cada escrita feita no backoffice, e como se diz.
 *
 * O `withStaff` regista cada pedido de escrita que corra bem em
 * `acoes_da_equipa`: quem, quando, o quê e sobre que registo. Esta tabela diz,
 * para cada rota, que ação é ("Reativou o cliente") e a que registo pertence
 * (o cliente do `[id]`), para o histórico aparecer na ficha certa.
 *
 * TODA a rota de escrita da política (src/lib/acessoApi.ts) tem de estar aqui
 * ou em NAO_REGISTAR, e o teste falha se aparecer uma nova por classificar.
 * Esquecer uma rota seria um buraco no histórico que ninguém via.
 */

export type EntidadeDoRegisto =
  | "pedido" | "cliente" | "tecnico" | "documento" | "pagamento" | "lote" | "contacto" | "ticket"
  | "fatura" | "colaborador" | "catalogo" | "zona" | "voucher" | "objetivo" | "campanha"
  | "configuracao" | "imposto" | "orcamento" | "tesouraria";

export interface Escrita {
  /** Como se lê no histórico, no passado: "Reativou o cliente". */
  acao: string;
  entidade: EntidadeDoRegisto;
  /** O parâmetro da rota com o id do registo (sem ele, fica sem id). */
  id?: string;
  /** A rota grava ela própria o registo, com motivo (não se repete). */
  registoProprio?: boolean;
}

export const ESCRITAS: Record<string, Escrita> = {
  // Catálogo e configurações
  "POST /allowed-zones": { acao: "Criou uma zona", entidade: "zona" },
  "PUT /allowed-zones/[id]": { acao: "Alterou uma zona", entidade: "zona", id: "id" },
  "POST /operation-areas": { acao: "Criou uma categoria", entidade: "catalogo" },
  "PUT /operation-areas/[id]": { acao: "Alterou uma categoria", entidade: "catalogo", id: "id" },
  "POST /services-types": { acao: "Criou um tipo de serviço", entidade: "catalogo" },
  "PUT /services-types/[id]": { acao: "Alterou um tipo de serviço", entidade: "catalogo", id: "id" },
  "DELETE /services-types/[id]": { acao: "Eliminou um tipo de serviço", entidade: "catalogo", id: "id" },
  "PUT /fee-settings": { acao: "Alterou as taxas", entidade: "configuracao" },
  "POST /documents": { acao: "Criou um documento exigido", entidade: "configuracao" },
  "PUT /documents/[id]": { acao: "Alterou um documento exigido", entidade: "configuracao", id: "id" },
  "POST /goals": { acao: "Criou um objetivo", entidade: "objetivo" },
  "PUT /goals/[id]": { acao: "Alterou um objetivo", entidade: "objetivo", id: "id" },
  "DELETE /goals/[id]": { acao: "Eliminou um objetivo", entidade: "objetivo", id: "id" },

  // Clientes
  "DELETE /customers/[id]/payment-methods/[methodId]": { acao: "Removeu um método de pagamento", entidade: "cliente", id: "id" },
  "PUT /customers/[id]/block": { acao: "Bloqueou o cliente", entidade: "cliente", id: "id", registoProprio: true },
  "PUT /customers/[id]/restore": { acao: "Reativou o cliente", entidade: "cliente", id: "id" },

  // Pedidos
  "POST /services": { acao: "Registou um serviço", entidade: "pedido" },
  "PUT /services/[id]": { acao: "Alterou o pedido", entidade: "pedido", id: "id" },
  "POST /vendor-no-shows/[id]/declare": { acao: "Declarou falta do técnico", entidade: "pedido", id: "id" },
  "POST /services/[id]/despachar": { acao: "Despachou o pedido personalizado", entidade: "pedido", id: "id" },
  "POST /services/[id]/fechar": { acao: "Fechou o pedido (cobrou e pagou ao técnico)", entidade: "pedido", id: "id", registoProprio: true },
  "POST /services/[id]/tentar-cobrar": { acao: "Tentou cobrar de novo", entidade: "pedido", id: "id" },
  "POST /services/[id]/desistir-e-devolver": { acao: "Desistiu da cobrança e devolveu ao cliente", entidade: "pedido", id: "id", registoProprio: true },

  // Técnicos
  "POST /technicians/test-account": { acao: "Criou uma conta de teste", entidade: "tecnico" },
  "PUT /technicians/[id]/at-validation": { acao: "Mudou a validação AT", entidade: "tecnico", id: "id" },
  "POST /technicians/[id]/invoice-workspace": { acao: "Criou o workspace de faturação", entidade: "tecnico", id: "id" },
  "PUT /technicians/[id]/suspend": { acao: "Suspendeu o técnico", entidade: "tecnico", id: "id", registoProprio: true },
  "PUT /technicians/[id]/restore": { acao: "Reativou o técnico", entidade: "tecnico", id: "id" },
  "DELETE /technicians/[id]/permanent": { acao: "Apagou o técnico", entidade: "tecnico", id: "id" },
  "PUT /vendor-documents/[id]/approve": { acao: "Aprovou um documento", entidade: "documento", id: "id" },
  "PUT /vendor-documents/[id]/decline": { acao: "Recusou um documento", entidade: "documento", id: "id" },

  // Dinheiro
  "POST /finance/app-payments/[uuid]/refund": { acao: "Reembolsou o pagamento", entidade: "pagamento", id: "uuid", registoProprio: true },
  "POST /finance/app-payments/[uuid]/cancel": { acao: "Libertou o cativo", entidade: "pagamento", id: "uuid" },
  "POST /finance/budget": { acao: "Criou uma linha do plano", entidade: "orcamento" },
  "PUT /finance/budget/[id]": { acao: "Alterou uma linha do plano", entidade: "orcamento", id: "id" },
  "DELETE /finance/budget/[id]": { acao: "Eliminou uma linha do plano", entidade: "orcamento", id: "id" },
  "POST /finance/company-invoices": { acao: "Registou uma fatura", entidade: "fatura" },
  "PUT /finance/company-invoices/[id]": { acao: "Alterou uma fatura", entidade: "fatura", id: "id" },
  "DELETE /finance/company-invoices/[id]": { acao: "Eliminou uma fatura", entidade: "fatura", id: "id" },
  "POST /finance/treasury": { acao: "Atualizou o saldo", entidade: "tesouraria" },
  "POST /finance/payout-lotes": { acao: "Criou um lote de pagamento", entidade: "lote" },
  "POST /finance/payout-lotes/[id]/aprovar": { acao: "Aprovou o lote", entidade: "lote", id: "id" },
  "POST /finance/payout-lotes/[id]/pagar": { acao: "Pagou o lote", entidade: "lote", id: "id" },
  "POST /finance/payout-lotes/[id]/cancelar": { acao: "Cancelou o lote", entidade: "lote", id: "id" },
  "POST /finance/payout-lotes/conferir": { acao: "Conferiu lotes com o extrato", entidade: "lote" },
  "PUT /tax/obligations/[id]/pay": { acao: "Marcou um imposto como pago", entidade: "imposto", id: "id" },
  "POST /employees": { acao: "Criou um colaborador", entidade: "colaborador" },
  "PUT /employees/[id]": { acao: "Alterou um colaborador", entidade: "colaborador", id: "id" },
  "DELETE /employees/[id]": { acao: "Eliminou um colaborador", entidade: "colaborador", id: "id" },

  // Contactos e marketing
  "POST /marketing/leads": { acao: "Registou um contacto", entidade: "contacto" },
  "PUT /marketing/leads/[id]": { acao: "Alterou o contacto", entidade: "contacto", id: "id" },
  "DELETE /marketing/leads/[id]": { acao: "Eliminou o contacto", entidade: "contacto", id: "id" },
  "POST /marketing/attribution/match": { acao: "Associou contactos a campanhas", entidade: "campanha" },
  "PUT /marketing/push-campaigns/[id]/active": { acao: "Ligou ou desligou uma campanha push", entidade: "campanha", id: "id" },
  "POST /marketing/ads/campaigns": { acao: "Criou uma campanha na Meta", entidade: "campanha" },
  "POST /marketing/ads/adsets": { acao: "Criou um conjunto de anúncios na Meta", entidade: "campanha" },
  "POST /marketing/ads/ads": { acao: "Criou um anúncio na Meta", entidade: "campanha" },
  "POST /marketing/ads/creatives": { acao: "Criou um criativo na Meta", entidade: "campanha" },
  "POST /marketing/ads/image": { acao: "Carregou uma imagem na Meta", entidade: "campanha" },
  "PUT /marketing/ads/status": { acao: "Ligou ou pausou anúncios na Meta", entidade: "campanha" },
  "PUT /marketing/google-ads/tracking": { acao: "Alterou o tracking do Google Ads", entidade: "campanha" },
  "POST /marketing/google-ads/campaigns": { acao: "Criou uma campanha no Google Ads", entidade: "campanha" },
  "POST /marketing/google-ads/adgroups": { acao: "Criou um grupo de anúncios no Google Ads", entidade: "campanha" },
  "POST /marketing/google-ads/search-ads": { acao: "Criou um anúncio de pesquisa no Google Ads", entidade: "campanha" },
  "POST /marketing/google-ads/display-ads": { acao: "Criou um anúncio de display no Google Ads", entidade: "campanha" },
  "POST /marketing/google-ads/image": { acao: "Carregou uma imagem no Google Ads", entidade: "campanha" },
  "PUT /marketing/google-ads/status": { acao: "Ligou ou pausou anúncios no Google Ads", entidade: "campanha" },
  "POST /vouchers": { acao: "Criou um voucher", entidade: "voucher" },
  "PUT /vouchers/[id]": { acao: "Alterou um voucher", entidade: "voucher", id: "id" },
  "DELETE /vouchers/[id]": { acao: "Eliminou um voucher", entidade: "voucher", id: "id" },

  // Suporte
  "PUT /support/inbox/[id]/status": { acao: "Mudou o estado do ticket", entidade: "ticket", id: "id" },
  "PUT /support/inbox/[id]/priority": { acao: "Mudou a prioridade do ticket", entidade: "ticket", id: "id" },
  "POST /support/inbox/[id]/reply": { acao: "Respondeu ao ticket", entidade: "ticket", id: "id" },
  "DELETE /support/inbox/[id]": { acao: "Eliminou o ticket", entidade: "ticket", id: "id" },
};

/**
 * Escritas que NÃO vão para o histórico, e porquê: são do próprio (as suas
 * tarefas, os seus avisos), conversa interna, ou mecânica sem efeito no
 * negócio. Registá-las enchia o histórico de ruído.
 */
export const NAO_REGISTAR: Record<string, string> = {
  "POST /alerts/snooze": "adiar um alerta é arrumar a própria fila",
  "DELETE /alerts/snooze": "idem",
  "POST /marketing/refresh": "ir buscar dados aos anúncios não muda nada",
  "POST /support/inbox/seed": "dados de exemplo de desenvolvimento",
  "DELETE /support/inbox/seed": "idem",
  "POST /push/subscribe": "avisos no próprio dispositivo",
  "DELETE /push/subscribe": "idem",
  "POST /push/test": "idem",
  "POST /tasks": "tarefas pessoais",
  "PUT /tasks/[id]": "idem",
  "DELETE /tasks/[id]": "idem",
  "POST /dev-tasks": "quadro de desenvolvimento",
  "PUT /dev-tasks/[id]": "idem",
  "DELETE /dev-tasks/[id]": "idem",
  "POST /team/channels": "conversa interna",
  "POST /team/meetings": "agenda interna",
  "POST /team/messages": "conversa interna",
  "POST /team/tasks": "tarefas da equipa",
  "PUT /team/tasks/[id]/status": "idem",
};

/** As ações com nome próprio (gravadas pelas rotas que pedem motivo). */
const ACOES_COM_NOME: Record<string, string> = {
  bloquear_cliente: "Bloqueou o cliente",
  suspender_tecnico: "Suspendeu o técnico",
  reembolsar_pagamento: "Reembolsou o pagamento",
  fechar_pedido: "Fechou o pedido (cobrou e pagou ao técnico)",
  desistir_e_devolver: "Desistiu da cobrança e devolveu ao cliente",
};

/** Como se lê uma ação gravada (pela chave da rota ou pelo nome próprio). */
export function rotuloDaAcao(acao: string): string {
  return ACOES_COM_NOME[acao] ?? ESCRITAS[acao]?.acao ?? acao;
}

/** O que registar de uma escrita bem sucedida; `null` se não for para registar. */
export function oQueRegistar(chave: string | null, params: Record<string, string>):
  { acao: string; entidade: EntidadeDoRegisto; entidadeId: string } | null {
  if (!chave) return null;
  const e = ESCRITAS[chave];
  if (!e || e.registoProprio) return null;
  return { acao: chave, entidade: e.entidade, entidadeId: (e.id && params[e.id]) || "" };
}
