import { supabaseAdmin } from "@/lib/supabase/server";
import { apiOk, apiErr, withStaff } from "../../_lib/handler";

interface ChannelRow { id: string; name: string; created_at: string }

function toChannel(r: ChannelRow) {
  return { id: r.id, name: r.name, unread: 0 };
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos (marcas diacríticas após NFD)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** GET /api/team/channels — canais de conversa da equipa (persistidos, criáveis por staff). */
export const GET = withStaff(async () => {
  const { data, error } = await supabaseAdmin().from("team_channels").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return apiOk((data ?? []).map((r) => toChannel(r as ChannelRow)));
});

/** POST /api/team/channels — cria um novo canal (qualquer staff pode). */
export const POST = withStaff(async (req, { staff }) => {
  const b = (await req.json()) as { name?: string };
  const name = b.name?.trim() ?? "";
  if (!name) return apiErr("Indica o nome do canal.", 400);

  const base = slugify(name) || "canal";
  let id = base;
  // Em caso de colisão de slug, acrescenta um sufixo curto -- raro (nomes
  // parecidos), mas evita rejeitar a criação por um detalhe técnico.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabaseAdmin()
      .from("team_channels")
      .insert({ id, name, created_by: staff.userId })
      .select("*")
      .single();
    if (!error) return apiOk(toChannel(data as ChannelRow), 201);
    if (error.code !== "23505") return apiErr(error.message, 400); // não é conflito de chave única
    id = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return apiErr("Não foi possível criar o canal, tenta outro nome.", 400);
});
