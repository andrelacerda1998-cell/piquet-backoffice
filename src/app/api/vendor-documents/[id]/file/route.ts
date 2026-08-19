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

/** Procura o documento pelo id: por rota dedicada e, se não existir, na fila. */
async function findDocument(id: string): Promise<VendorDocument | null> {
  try {
    const doc = await laravelAdminRequest<VendorDocument>(`/v1/admin/vendor-documents/${id}`);
    if (doc?.file_url) return doc;
  } catch {
    // Backend sem rota individual — procura nas filas por estado.
  }
  for (const status of ["pending", "approved", "declined"] as const) {
    try {
      const page = await laravelAdminRequest<VendorDocumentsData>(
        `/v1/admin/vendor-documents?status=${status}&page=1&per_page=200`,
      );
      const hit = (page?.items ?? []).find((d) => String(d.id) === String(id));
      if (hit?.file_url) return hit;
    } catch {
      // ignora e tenta o estado seguinte
    }
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
