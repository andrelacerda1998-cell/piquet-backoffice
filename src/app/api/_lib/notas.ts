import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import { apiErr, apiOk, type StaffContext } from "./handler";

/**
 * Notas internas da equipa (tabela `notas_internas`): o que se sabe de um
 * pedido, de um cliente ou de um técnico e não está no Laravel. Só se
 * acrescentam -- a base de dados recusa editar ou apagar.
 */
export type EntidadeDaNota = "pedido" | "cliente" | "tecnico";

export interface NotaInterna {
  id: string;
  criadoEm: string;
  autor: string;
  texto: string;
}

export const TEXTO_MAXIMO = 2000;
export const SEM_TABELA_NOTAS = "Falta a tabela notas_internas no Supabase (migração 20261012100000).";

interface Linha {
  id: string;
  criado_em: string;
  staff_email: string | null;
  staff_nome: string | null;
  texto: string;
}

const paraNota = (l: Linha): NotaInterna => ({
  id: l.id, criadoEm: l.criado_em, texto: l.texto,
  autor: l.staff_nome || l.staff_email || "Alguém da equipa",
});

type Contexto = { staff: StaffContext; params: Record<string, string> };

/** GET `/api/<coisa>/:id/notas`: as notas de uma ficha, as mais recentes primeiro. */
export function lerNotas(entidade: EntidadeDaNota) {
  return async (_req: Request, { params }: Contexto) => {
    const { data, error } = await supabaseAdmin()
      .from("notas_internas")
      .select("id, criado_em, staff_email, staff_nome, texto")
      .eq("entidade", entidade)
      .eq("entidade_id", params.id)
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) {
      // Sem a migração ainda aplicada, a ficha mostra que não há notas em vez de rebentar.
      if (isMissingTable(error, "notas_internas")) return apiOk<NotaInterna[]>([]);
      return apiErr(error.message, 500);
    }
    return apiOk<NotaInterna[]>(((data ?? []) as Linha[]).map(paraNota));
  };
}

/** POST `/api/<coisa>/:id/notas`: acrescenta uma nota, assinada por quem a escreve. */
export function acrescentarNota(entidade: EntidadeDaNota) {
  return async (req: Request, { params, staff }: Contexto) => {
    const body = (await req.json().catch(() => ({}))) as { texto?: unknown };
    const texto = typeof body.texto === "string" ? body.texto.trim() : "";
    if (!texto) return apiErr("Escreve a nota.", 422);
    if (texto.length > TEXTO_MAXIMO) return apiErr(`A nota tem de ter no máximo ${TEXTO_MAXIMO} caracteres.`, 422);
    return escreverNota(staff, entidade, params.id, texto);
  };
}

async function escreverNota(staff: StaffContext, entidade: EntidadeDaNota, id: string, texto: string) {
  const { data, error } = await supabaseAdmin()
    .from("notas_internas")
    .insert({ staff_id: staff.userId, staff_email: staff.email, staff_nome: staff.name || null, entidade, entidade_id: id, texto })
    .select("id, criado_em, staff_email, staff_nome, texto")
    .single();
  if (error) {
    return isMissingTable(error, "notas_internas") ? apiErr(SEM_TABELA_NOTAS, 503) : apiErr(error.message, 500);
  }
  return apiOk<NotaInterna>(paraNota(data as Linha), 201);
}
