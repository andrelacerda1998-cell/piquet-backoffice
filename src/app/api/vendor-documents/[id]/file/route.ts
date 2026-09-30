import { fetchComPrazo } from "@/lib/fetchTimeout";
import { withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import type { VendorDocument, VendorDocumentsData } from "../../route";

/**
 * GET /api/vendor-documents/:id/file — serve o ficheiro KYC para PRÉ-VISUALIZAR
 * no backoffice.
 *
 * Porquê um proxy e não o `file_url` direto: o armazenamento devolve os
 * documentos com `Content-Disposition: attachment` (o browser descarrega em vez
 * de mostrar) e muitas vezes com `X-Frame-Options`, que impede o <iframe>. Aqui
 * reenviamos o mesmo conteúdo com `inline`, para abrir dentro do ecrã.
 *
 * Segurança: exige sessão de staff (withStaff) e o URL de origem vem do Laravel
 * — nunca do cliente —, por isso não é um proxy aberto (sem risco de SSRF).
 */

export const dynamic = "force-dynamic";

/**
 * Procura o documento pelo id: por rota dedicada e, se não existir, na fila.
 *
 * O RECURSO PERCORRE AS PÁGINAS TODAS, e não só a primeira.
 *
 * Pedia-se `per_page=200` e olhava-se para a página 1. O controlador do
 * Laravel limita a 100 (`min($perPage, 100)`), por isso vinham 100 — e em
 * produção há 449 documentos aprovados.
 *
 * Resultado: enquanto o documento estava PENDENTE a fila era curta e abria;
 * assim que fosse validado passava para a fila dos aprovados e, se não
 * estivesse nos primeiros 100, deixava de abrir para sempre. O ecrã dizia
 * "Documento sem ficheiro associado", que soa a documento estragado quando o
 * problema era não o termos procurado até ao fim. (Danúbia Trintrim,
 * comunicado a 30/09/2026.)
 *
 * A ordem dos estados não é arbitrária: `approved` primeiro porque é onde o
 * documento está quando alguém o quer reabrir — quem abre um pendente
 * encontra-o na mesma, uma volta depois.
 */
async function findDocument(id: string): Promise<VendorDocument | null> {
  try {
    const doc = await laravelAdminRequest<VendorDocument>(`/v1/admin/vendor-documents/${id}`);
    if (doc?.file_url) return doc;
  } catch {
    // Backend sem rota individual — procura nas filas por estado.
  }

  const POR_PAGINA = 100; // o máximo que o Laravel aceita

  for (const status of ["approved", "pending", "declined"] as const) {
    let pagina = 1;
    let ultima = 1;
    do {
      try {
        const r = await laravelAdminRequest<VendorDocumentsData>(
          `/v1/admin/vendor-documents?status=${status}&page=${pagina}&per_page=${POR_PAGINA}`,
        );
        const hit = (r?.items ?? []).find((d) => String(d.id) === String(id));
        if (hit?.file_url) return hit;
        ultima = r?.meta?.last_page ?? pagina;
      } catch {
        // Uma página que rebenta no Laravel não pode matar a procura: o
        // documento pode estar na seguinte.
      }
      pagina++;
      // Trava: 50 páginas de 100 são 5000 documentos, muito acima do que há.
    } while (pagina <= ultima && pagina <= 50);
  }
  return null;
}

export const GET = withStaff(async (_req, { params }) => {
  const id = params.id;

  const doc = await findDocument(id);
  if (!doc?.file_url) {
    return new Response("Documento sem ficheiro associado.", { status: 404 });
  }

  // Com prazo: um ficheiro alojado num servidor lento pendurava o proxy.
  const upstream = await fetchComPrazo(doc.file_url, { cache: "no-store" }, 30_000);
  if (!upstream.ok || !upstream.body) {
    return new Response("Não foi possível obter o ficheiro.", { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  // O essencial: mostrar no browser em vez de descarregar.
  headers.set("Content-Disposition", "inline");
  // Documentos KYC são pessoais — nunca em caches partilhadas.
  headers.set("Cache-Control", "private, no-store");

  return new Response(upstream.body, { status: 200, headers });
});
