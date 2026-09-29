import "server-only";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { toTicketInbox, type TicketTecnicoLaravel, type TicketInbox } from "@/lib/ticketsTecnicos";

/**
 * Os tickets dos técnicos, do Laravel, na forma da caixa de entrada.
 *
 * Só existem a partir do PR #106 do backend. Enquanto ele não estiver
 * publicado, `/v1/admin/support-tickets` devolve 404 — e isso NÃO pode
 * derrubar a caixa de entrada: os tickets dos clientes continuam a chegar. Por
 * isso uma falha aqui devolve lista vazia e o motivo, que o ecrã mostra como
 * aviso em vez de deixar a página em branco.
 */
export async function ticketsDeTecnicos(): Promise<{ tickets: TicketInbox[]; erro: string | null }> {
  if (!LARAVEL_ADMIN_ENABLED) {
    return { tickets: [], erro: "Os tickets dos técnicos vivem no Laravel, e essa ligação não está ligada." };
  }

  try {
    const todos: TicketTecnicoLaravel[] = [];
    // Paginado: o Laravel limita a 100 por página, e foi assim que a
    // sincronização de técnicos leu 100 de 438 durante semanas.
    for (let pagina = 1; pagina <= 20; pagina++) {
      const r = await laravelAdminRequest<{ items: TicketTecnicoLaravel[]; meta: { last_page: number } }>(
        `/v1/admin/support-tickets?per_page=100&page=${pagina}`,
      );
      todos.push(...(r.items ?? []));
      if (pagina >= (r.meta?.last_page ?? 1)) break;
    }
    return { tickets: todos.map(toTicketInbox), erro: null };
  } catch (e) {
    return {
      tickets: [],
      erro: e instanceof Error ? e.message : "Não foi possível ler os tickets dos técnicos.",
    };
  }
}
