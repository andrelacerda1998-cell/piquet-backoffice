import type { DashboardAlert } from "@/types";

/*
  O destino de cada alerta, partilhado pelo ecrã de Alertas e pela fila
  "Precisa de ti" da Visão Geral: o mesmo alerta leva ao mesmo sítio.
*/

/** Para onde vai o botão de cada alerta, conforme o que o originou. */
export function destinoDoAlerta(a: DashboardAlert): { href: string; label: string } {
  // Os `tab` têm de bater certo com os ids reais de cada página — três destes
  // apontavam para separadores que não existem ("kyc", "faturas") e o clique
  // abria a página no separador por omissão, como se não tivesse funcionado.
  switch (a.entityType) {
    // Com o id, o CRM abre o pedido em vez de deixar o utilizador à procura.
    case "lead": return { href: `/leads?lead=${a.entityId ?? ""}`, label: "Abrir contacto" };
    // Os alertas agrupados apontam para a lista: são vários registos, não um.
    case "leads": return { href: "/leads", label: "Ver contactos" };
    case "tickets": return { href: "/suporte", label: "Ver tickets" };
    case "ticket": return { href: `/suporte?ticket=${a.entityId ?? ""}`, label: "Abrir ticket" };
    case "integracao": return { href: "/produto?tab=integracoes", label: "Ver integrações" };
    case "kyc": return { href: "/tecnicos?tab=aprovacoes", label: "Rever documentos" };
    case "marketing": return { href: "/marketing", label: "Ir para Marketing" };
    case "pagamentos": return { href: "/financeiro?tab=app-pagamentos", label: "Ver pagamentos" };
    case "fatura": return { href: "/financeiro?tab=custos", label: "Ver faturas" };
    // KYC, integrações e impostos são filas/listas, não um registo só — o
    // destino certo é mesmo o separador.
    case "imposto": return { href: "/financeiro?tab=impostos", label: "Ver impostos" };
    // A operação: o pedido abre-se pelo número (é o que o ⌘K também faz).
    case "pedido": return { href: `/servicos?servico=${encodeURIComponent(a.entityId ?? "")}`, label: "Abrir pedido" };
    case "lotes": return { href: "/financeiro?tab=pagamentos", label: "Ver lotes" };
    default: return { href: "/", label: "Abrir" };
  }
}
