import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * GET /api/technicians/documentos — porque é que a documentação está
 * incompleta, e QUEM é que se pode resolver hoje.
 *
 * "158 com documentação incompleta" não dizia o que fazer. São três problemas
 * diferentes com respostas diferentes:
 *
 * - EXPIRADOS: já tiveram tudo aprovado, provavelmente já trabalharam, e o
 *   documento caducou. Pararam sem ninguém dar por isso. Um telefonema e um
 *   reenvio resolve.
 * - RECUSADOS: submeteram e foi-lhes dito que não. Até hoje viam o motivo de
 *   OUTRA pessoa na app (backend #128), o que pode explicar quem não corrigiu.
 * - NUNCA SUBMETERAM: são 337, a mesma população dos registos abandonados.
 *   Ficam na contagem e não em lista -- resolvem-se no funil de inscrição.
 *
 * O Laravel agrega isto numa só chamada (#128, #129): por técnico seriam
 * centenas de consultas por página.
 */

export const dynamic = "force-dynamic";

export interface DocumentoEmFalta {
  nome: string;
  /** Data em que caducou (expirados). */
  em?: string | null;
  /** Motivo escrito pela equipa (recusados). */
  motivo?: string | null;
}

export interface TecnicoComDocumento {
  id: number;
  name: string | null;
  documentos: DocumentoEmFalta[];
}

export interface ResumoDocumentos {
  total: number;
  completos: number;
  com_expirado: number;
  com_recusado: number;
  com_por_rever: number;
  nunca_submeteram: number;
  expirados: TecnicoComDocumento[];
  recusados: TecnicoComDocumento[];
}

export const GET = withStaff(async () => {
  if (!LARAVEL_ADMIN_ENABLED) return apiErr("API de admin do Laravel não configurada.", 503);
  try {
    return apiOk(await laravelAdminRequest<ResumoDocumentos>("/v1/admin/vendors/documents-summary"));
  } catch (e) {
    return apiErr(
      e instanceof ApiError ? e.message : "Erro ao ler o estado dos documentos.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
