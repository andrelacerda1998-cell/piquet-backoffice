import { fetchComPrazo } from "@/lib/fetchTimeout";
import { withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import type { VendorDocument } from "../../route";

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
 * O documento, pelo seu id.
 *
 * ANTES ISTO PERCORRIA AS FILAS TODAS. Pedia-se a lista por estado e
 * procurava-se lá dentro, página a página, porque o Laravel não tinha rota
 * individual: o `index` filtra por estado e pagina, e um documento validado
 * ficava inalcançável a partir da segunda centena de aprovados. O ecrã dizia
 * "Documento sem ficheiro associado", que soa a documento estragado quando o
 * problema era não o termos procurado até ao fim. (Danúbia Trintrim,
 * 30/09/2026.)
 *
 * A rota individual existe desde hoje (backend #117) e está em produção, por
 * isso a travessia saiu: eram até 150 pedidos ao Laravel para encontrar um
 * documento que agora se pede por id.
 *
 * NÃO se guarda um recurso à travessia de propósito. Um recurso silencioso
 * mascara a rota a faltar -- e foi precisamente uma procura que falhava em
 * silêncio que criou este problema. Se a rota responder mal, quem abrir o
 * documento vê a razão, em vez de ver "sem ficheiro" e concluir a coisa
 * errada.
 */
async function findDocument(id: string): Promise<{ doc: VendorDocument | null; erro?: string }> {
  try {
    const doc = await laravelAdminRequest<VendorDocument>(`/v1/admin/vendor-documents/${id}`);
    return { doc: doc ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[vendor-documents/${id}/file] o Laravel recusou:`, msg);
    return { doc: null, erro: msg };
  }
}

export const GET = withStaff(async (_req, { params }) => {
  const id = params.id;

  const { doc, erro } = await findDocument(id);

  /*
    Três desfechos, e três mensagens diferentes. Antes eram todos "sem
    ficheiro associado", e foi isso que fez parecer que o documento da Danúbia
    estava estragado quando o problema era nosso.
  */
  if (erro) {
    return new Response(`Não foi possível pedir o documento ao backend: ${erro}`, { status: 502 });
  }
  if (!doc) {
    return new Response("Documento não encontrado.", { status: 404 });
  }
  if (!doc.file_url) {
    return new Response("Este documento não tem ficheiro associado.", { status: 404 });
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
