import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { esperaPeloWorkspace } from "@/lib/avisosOperacao";
import { ApiError } from "@/services/http";

/**
 * GET /api/technicians/awaiting-workspace — quem já entregou o acesso à AT e
 * espera que lhe criem o workspace de faturação.
 *
 * Existe como rota própria, e não como filtro da lista, porque a lista é
 * PAGINADA: filtrar a página aberta encontrava dois ou três dos oito, e quem
 * olhasse ficava a achar que eram só esses. Aqui percorrem-se as páginas do
 * lado do servidor e devolve-se só quem interessa.
 *
 * A condição é a MESMA que dispara a notificação (`esperaPeloWorkspace`),
 * importada e não copiada: duas cópias divergiriam ao primeiro ajuste, e o
 * resultado seria um aviso a apontar para um ecrã vazio.
 */

export const dynamic = "force-dynamic";

/**
 * O retrato completo, e não só a fila.
 *
 * "Quantos técnicos podem mesmo faturar?" não tinha resposta em lado nenhum:
 * o ecrã mostrava quem faltava, nunca quem já estava feito. Como a rota já
 * percorre todos os técnicos para encontrar a fila, contar os outros sai de
 * graça -- e um total sem denominador não diz nada.
 */
export interface ContagemWorkspaces {
  /** Técnicos lidos do Laravel. */
  total: number;
  /** Já têm workspace de faturação criado: estes podem faturar. */
  comWorkspace: number;
  /** Entregaram a AT e não têm nada em falta -- é a fila. */
  aEspera: number;
  /** Entregaram a AT mas falta-lhes documento, IBAN ou morada fiscal. */
  bloqueados: number;
}

export interface TecnicoSemWorkspace {
  id: number;
  name: string | null;
  at_user: string | null;
  created_at: string | null;
}

interface Resposta {
  items: Array<{
    id: number;
    name: string | null;
    at_user?: string | null;
    invoice_workspace?: string | null;
    account_blocker?: string | null;
    created_at?: string | null;
  }>;
  meta?: { last_page?: number };
}

export const GET = withStaff(async () => {
  if (!LARAVEL_ADMIN_ENABLED) return apiErr("API de admin do Laravel não configurada.", 503);

  try {
    const espera: TecnicoSemWorkspace[] = [];
    const contagem: ContagemWorkspaces = { total: 0, comWorkspace: 0, aEspera: 0, bloqueados: 0 };
    let pagina = 1;
    let ultima = 1;

    do {
      /*
        O controlador do Laravel trava o `per_page` em 100 e cala-se, por isso
        percorrem-se as páginas em vez de pedir um número grande e acreditar.
        É a mesma lição do documento da Danúbia.
      */
      const r = await laravelAdminRequest<Resposta>(`/v1/admin/vendors?per_page=100&page=${pagina}`);
      const itens = r.items ?? [];

      for (const v of itens) {
        contagem.total++;
        if (v.invoice_workspace) contagem.comWorkspace++;
        else if ((v.at_user ?? "").includes("/") && v.account_blocker) contagem.bloqueados++;

        const aguarda = esperaPeloWorkspace({
          id: v.id,
          atUser: v.at_user,
          invoiceWorkspace: v.invoice_workspace,
          blocker: v.account_blocker,
        });
        if (aguarda) {
          contagem.aEspera++;
          espera.push({
            id: v.id,
            name: v.name,
            at_user: v.at_user ?? null,
            created_at: v.created_at ?? null,
          });
        }
      }

      ultima = r.meta?.last_page ?? (itens.length === 100 ? pagina + 1 : pagina);
      pagina++;
    } while (pagina <= ultima && pagina <= 20);

    // Os mais antigos primeiro: são os que estão à espera há mais tempo.
    espera.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));

    return apiOk({ items: espera, total: espera.length, contagem });
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao ler os técnicos.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
