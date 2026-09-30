import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { esperaPeloWorkspace } from "@/lib/avisosOperacao";
import { ApiError } from "@/services/http";

/**
 * GET /api/technicians/funil — onde é que cada técnico está preso no caminho
 * até poder aceitar serviços.
 *
 * Existe como rota própria, e não como filtro da lista, porque a lista é
 * PAGINADA: filtrar a página aberta encontrava dois ou três dos oito, e quem
 * olhasse ficava a achar que eram só esses. Aqui percorrem-se as páginas do
 * lado do servidor.
 *
 * Chamava-se `awaiting-workspace` quando só sabia contar a fila do workspace.
 * Passou a responder a "onde é que os técnicos estão presos", que é a mesma
 * travessia e mais três contagens -- e um nome que dissesse só metade levava
 * a próxima pessoa a criar uma segunda rota a percorrer os mesmos 460.
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
  /**
   * Perfil completo: documentos validados E workspace criado.
   *
   * O Laravel não expõe `all_documents_verified` por técnico -- só o usa numa
   * contagem agregada noutro endpoint. Deriva-se do `account_blocker`, que
   * devolve o PRIMEIRO problema pela ordem: contactos, documentos, IBAN,
   * morada fiscal. Se o código for `iban_missing` ou `fiscal_address_missing`,
   * passou-se a verificação dos documentos e portanto estão validados.
   *
   * Fica um caso cego: `contact_unverified` vem antes e tapa o que vem a
   * seguir. Esse é contado em `contactoPorVerificar` -- se for zero, este
   * número é exacto; se não for, é o erro máximo possível, e não se esconde.
   */
  perfilCompleto: number;
  /**
   * Quantos técnicos não se conseguem classificar quanto a documentos.
   *
   * É a margem de erro do `perfilCompleto`, e existe para não se apresentar
   * um número derivado como se fosse medido.
   */
  contactoPorVerificar: number;
  /**
   * Podem aceitar serviços. É o `can_accept_service` do Laravel, que é a
   * autoridade -- não se recalcula aqui, porque duas contas da mesma coisa
   * acabam sempre por discordar.
   */
  podemAceitar: number;
  /**
   * Têm tudo o resto aprovado e falta-lhes SÓ o subutilizador da AT.
   *
   * São os que estão a um passo, e o passo é deles. Distinguem-se dos
   * "bloqueados" porque ali o que falta são documentos ou dados nossos de
   * validar; aqui falta uma coisa que só o técnico pode entregar.
   */
  soFaltaAT: number;
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
    can_accept_service?: boolean;
    created_at?: string | null;
  }>;
  meta?: { last_page?: number };
}

export const GET = withStaff(async () => {
  if (!LARAVEL_ADMIN_ENABLED) return apiErr("API de admin do Laravel não configurada.", 503);

  try {
    const espera: TecnicoSemWorkspace[] = [];
    const contagem: ContagemWorkspaces = {
      total: 0, comWorkspace: 0, aEspera: 0, bloqueados: 0,
      perfilCompleto: 0, podemAceitar: 0, soFaltaAT: 0, contactoPorVerificar: 0,
    };
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
        const temAT = (v.at_user ?? "").includes("/");

        if (v.invoice_workspace) contagem.comWorkspace++;
        else if (temAT && v.account_blocker) contagem.bloqueados++;

        if (v.can_accept_service) contagem.podemAceitar++;

        // Ver a nota em `perfilCompleto`: estes dois códigos só aparecem
        // DEPOIS de os documentos passarem, logo garantem que passaram.
        const docsValidados = !v.account_blocker
          || v.account_blocker === "iban_missing"
          || v.account_blocker === "fiscal_address_missing";

        if (v.account_blocker === "contact_unverified") contagem.contactoPorVerificar++;
        if (docsValidados && v.invoice_workspace) contagem.perfilCompleto++;

        // Nada a bloquear do lado dele, exceto a AT -- está a um passo.
        if (!v.account_blocker && !temAT) contagem.soFaltaAT++;

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
