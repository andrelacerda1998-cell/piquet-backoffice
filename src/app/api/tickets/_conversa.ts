import { supabaseAdmin } from "@/lib/supabase/server";

/** Uma mensagem tal como fica guardada no jsonb do ticket. */
export interface MensagemGuardada {
  id: string;
  from: "requester" | "agente";
  authorName: string;
  body: string;
  at: string;
  /** Caminhos no bucket privado. Assinados antes de saírem daqui. */
  images?: string[];
}

/** Meia hora chega para ler uma conversa; um URL eterno não. */
const VALIDADE_URL_SEGUNDOS = 30 * 60;

/**
 * Assina as fotos de uma conversa antes de a mandar para a app.
 *
 * O bucket é privado. A autorização aqui é a posse do `access_token` do ticket
 * — o mesmo que já autoriza ler o estado — e por isso só se assina o que
 * pertence aos tickets que já passaram por esse filtro. Uma foto que não
 * assine sai da mensagem, em vez de deixar um ícone partido no telemóvel.
 */
export async function assinarImagensDoCliente<T extends { messages: MensagemGuardada[] }>(
  tickets: T[],
): Promise<T[]> {
  const caminhos = new Set<string>();
  for (const t of tickets) {
    for (const m of t.messages) {
      if (Array.isArray(m?.images)) m.images.forEach((p) => typeof p === "string" && caminhos.add(p));
    }
  }
  if (caminhos.size === 0) return tickets;

  const lista = [...caminhos];
  const { data } = await supabaseAdmin()
    .storage.from("ticket-images")
    .createSignedUrls(lista, VALIDADE_URL_SEGUNDOS);

  const porCaminho = new Map<string, string>();
  (data ?? []).forEach((r, i) => {
    if (r.signedUrl) porCaminho.set(lista[i], r.signedUrl);
  });

  return tickets.map((t) => ({
    ...t,
    messages: t.messages.map((m) =>
      Array.isArray(m?.images)
        ? { ...m, images: m.images.map((p) => porCaminho.get(p)).filter((u): u is string => !!u) }
        : m,
    ),
  }));
}
