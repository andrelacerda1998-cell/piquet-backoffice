import { apiGet, apiPut, API_URL, USE_REAL_API, currentToken } from "./api";

/**
 * Revisão de documentos KYC dos técnicos — migrado do Filament
 * (VendorDocumentTextEntry: ações "Verificar"/"Recusar") para a API de admin
 * do Laravel. Ver src/lib/laravelAdmin.ts e src/app/api/vendor-documents/*.
 *
 * Aprovar/recusar aqui é uma ação real: o Laravel notifica o técnico (email +
 * push), tal como no Filament — não é um formulário local.
 */
export type VendorDocumentStatus = "pending" | "approved" | "declined";

export interface VendorDocument {
  id: number;
  vendor_id: number;
  vendor_name: string | null;
  document_type: string | null;
  status: VendorDocumentStatus;
  reason: string | null;
  expiration_date: string | null;
  file_url: string | null;
  created_at: string | null;
}

export interface VendorDocumentsData {
  items: VendorDocument[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function getVendorDocuments(status: VendorDocumentStatus = "pending", page = 1, perPage = 20): Promise<VendorDocumentsData> {
  return apiGet<VendorDocumentsData>(
    "/vendor-documents",
    () => ({ items: [], meta: { current_page: 1, last_page: 1, per_page: perPage, total: 0 } }),
    { status, page, per_page: perPage }
  ).then((r) => r.data);
}

/**
 * Traz o ficheiro KYC já pronto a MOSTRAR (sem download) e devolve um `blob:`
 * para usar em <img>/<iframe>.
 *
 * Passa pelo proxy /vendor-documents/:id/file, que reenvia o documento com
 * `Content-Disposition: inline` (o armazenamento manda `attachment`, o que
 * obrigava o browser a descarregar). Como esse proxy exige sessão de staff e as
 * tags <img>/<iframe> não enviam o cabeçalho `Authorization`, buscamos aqui com
 * fetch autenticado e convertemos em object URL.
 *
 * Quem chama deve fazer `URL.revokeObjectURL(url)` ao fechar, para libertar
 * memória. Sem backend configurado devolve `null` (o chamador cai no file_url).
 */
export async function getVendorDocumentBlobUrl(id: number): Promise<string | null> {
  if (!USE_REAL_API || typeof window === "undefined") return null;
  const token = await currentToken();
  const res = await fetch(`${API_URL}/vendor-documents/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Não foi possível abrir o documento.");
  return URL.createObjectURL(await res.blob());
}

/** Resultado de uma recolha completa: o que veio e o que não foi possível ler. */
export interface AllVendorDocuments {
  items: VendorDocument[];
  /** Documentos que o backend não conseguiu devolver (páginas com erro). */
  falharam: number;
}

/**
 * TODOS os documentos de um estado, percorrendo as páginas.
 *
 * Porquê isto e não uma página grande: em produção há 449 documentos aprovados
 * e o backend limita cada página a 100 — pedir "200" trazia 100 e os mais
 * antigos ficavam de fora (era por isso que os técnicos validados há mais tempo
 * apareciam sem documentos).
 *
 * Além disso, algumas páginas rebentam no Laravel ("Server Error", ~0,4 s, logo
 * não é timeout — há registos que ele não consegue serializar). Em vez de
 * perder o estado inteiro, tenta-se a página em pedaços menores e o que não vier
 * é contado em `falharam`, para o ecrã poder dizer que a lista está incompleta.
 */
export async function getAllVendorDocuments(status: VendorDocumentStatus): Promise<AllVendorDocuments> {
  // Páginas pequenas de propósito: com per_page=100 o backend falha quase
  // sempre (incluindo a página 1); com 20 falha só em páginas específicas.
  const PER_PAGE = 20;
  const RETRY = 5;      // pedaço menor para recuperar uma página que falhou
  const LOTE = 6;       // pedidos em paralelo

  const fetchPage = (page: number, perPage: number) =>
    getVendorDocuments(status, page, perPage).then((r) => r.items).catch(() => null);

  // Descobrir o total. Se a primeira página falhar, NÃO desistir — tenta um
  // pedaço menor só para ler o `meta` (era aqui que a lista saía vazia sem
  // sequer avisar).
  let total = 0;
  const head = await getVendorDocuments(status, 1, PER_PAGE).catch(() => null)
    ?? await getVendorDocuments(status, 1, RETRY).catch(() => null);
  if (!head) return { items: [], falharam: 0 };
  total = head.meta.total ?? head.items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / PER_PAGE));

  const items: VendorDocument[] = [];
  const falhadas: number[] = [];

  for (let inicio = 1; inicio <= totalPaginas; inicio += LOTE) {
    const paginas = Array.from({ length: Math.min(LOTE, totalPaginas - inicio + 1) }, (_, k) => inicio + k);
    const res = await Promise.all(paginas.map((pg) => fetchPage(pg, PER_PAGE)));
    res.forEach((r, k) => (r ? items.push(...r) : falhadas.push(paginas[k])));
  }

  // Segunda passagem: as páginas que rebentaram são tentadas em pedaços de 5,
  // para salvar os documentos que estão bons ao lado dos que o backend não
  // consegue serializar.
  let falharam = 0;
  for (const pg of falhadas) {
    const base = (pg - 1) * PER_PAGE;
    const subs = Array.from({ length: PER_PAGE / RETRY }, (_, k) => Math.floor((base + k * RETRY) / RETRY) + 1);
    const res = await Promise.all(subs.map((sp) => fetchPage(sp, RETRY)));
    res.forEach((r) => (r ? items.push(...r) : (falharam += RETRY)));
  }

  // O backend pode devolver o mesmo documento em pedidos diferentes.
  const porId = new Map(items.map((d) => [d.id, d]));
  return { items: [...porId.values()], falharam };
}

export async function approveVendorDocument(id: number, expirationDate?: string | null): Promise<VendorDocument> {
  return apiPut<VendorDocument>(`/vendor-documents/${id}/approve`, { expiration_date: expirationDate || null }, () => {
    throw new Error("Documentos KYC precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}

export async function declineVendorDocument(id: number, reason: string): Promise<VendorDocument> {
  return apiPut<VendorDocument>(`/vendor-documents/${id}/decline`, { reason }, () => {
    throw new Error("Documentos KYC precisam da API de admin do Laravel configurada.");
  }).then((r) => r.data);
}
