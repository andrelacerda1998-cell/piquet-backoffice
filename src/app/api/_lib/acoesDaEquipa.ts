import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import type { StaffContext } from "./handler";

/**
 * Quem da equipa fez o quê, e porquê (tabela `acoes_da_equipa`).
 *
 * O Laravel só vê o token partilhado do backoffice; isto é o único sítio que
 * sabe que foi a Ana a bloquear o cliente 412. O registo é escrito ANTES da
 * ação e retirado se ela falhar (o mesmo padrão dos lotes): assim nunca há
 * uma ação feita sem motivo guardado.
 */
export type AcaoDaEquipa = "bloquear_cliente" | "suspender_tecnico" | "reembolsar_pagamento";
export type Entidade = "cliente" | "tecnico" | "pagamento";

export interface RegistoDeAcao {
  id: string;
  criado_em: string;
  staff_email: string | null;
  acao: AcaoDaEquipa;
  entidade: Entidade;
  entidade_id: string;
  motivo: string | null;
}

export const SEM_TABELA_ACOES =
  "Falta a tabela acoes_da_equipa no Supabase (migração 20261008180000). Sem ela não há onde guardar o motivo.";

type Resultado = { ok: true; id: string } | { ok: false; erro: string; status: number };

export async function registarAcao(
  staff: StaffContext,
  acao: AcaoDaEquipa,
  entidade: Entidade,
  entidadeId: string,
  motivo: string,
  detalhe?: Record<string, unknown>,
): Promise<Resultado> {
  const { data, error } = await supabaseAdmin().from("acoes_da_equipa").insert({
    staff_id: staff.userId, staff_email: staff.email, acao, entidade, entidade_id: entidadeId, motivo,
    detalhe: detalhe ?? null,
  }).select("id").single();
  if (error) {
    return isMissingTable(error, "acoes_da_equipa")
      ? { ok: false, erro: SEM_TABELA_ACOES, status: 503 }
      : { ok: false, erro: error.message, status: 500 };
  }
  return { ok: true, id: (data as { id: string }).id };
}

/** Retira o registo de uma ação que acabou por não acontecer. */
export async function anularRegisto(id: string): Promise<void> {
  await supabaseAdmin().from("acoes_da_equipa").delete().eq("id", id);
}

/** O registo mais recente de cada entidade para uma ação (ex.: porque está bloqueado). */
export async function ultimosRegistos(acao: AcaoDaEquipa): Promise<RegistoDeAcao[] | null> {
  const { data, error } = await supabaseAdmin()
    .from("acoes_da_equipa")
    .select("id, criado_em, staff_email, acao, entidade, entidade_id, motivo")
    .eq("acao", acao)
    .order("criado_em", { ascending: false })
    .limit(1000);
  if (error) {
    if (isMissingTable(error, "acoes_da_equipa")) return null;
    throw new Error(error.message);
  }
  const vistos = new Set<string>();
  return (data as RegistoDeAcao[]).filter((r) => !vistos.has(r.entidade_id) && vistos.add(r.entidade_id));
}

/**
 * Regista uma escrita genérica (sem motivo), chamada pelo `withStaff` depois
 * de a rota correr bem. Nunca falha o pedido: se não conseguir gravar, avisa
 * no log e segue -- a ação já aconteceu, e devolver erro seria mentir.
 */
export async function registarEscrita(
  staff: StaffContext,
  r: { acao: string; entidade: string; entidadeId: string },
  detalhe: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("acoes_da_equipa").insert({
      staff_id: staff.userId, staff_email: staff.email,
      acao: r.acao, entidade: r.entidade, entidade_id: r.entidadeId, motivo: null, detalhe,
    });
    if (error && !isMissingTable(error, "acoes_da_equipa")) console.error("[acoes_da_equipa]", error.message);
  } catch (e) {
    console.error("[acoes_da_equipa]", e instanceof Error ? e.message : e);
  }
}

export interface EntradaDoHistorico {
  id: string;
  criado_em: string;
  staff_email: string | null;
  acao: string;
  entidade: string;
  entidade_id: string;
  motivo: string | null;
  detalhe: Record<string, unknown> | null;
}

const COLUNAS = "id, criado_em, staff_email, acao, entidade, entidade_id, motivo, detalhe";

/**
 * O histórico de um registo, do mais recente para o mais antigo. Num pedido
 * entra também o reembolso do pagamento dele (gravado no pagamento, com o
 * pedido no detalhe). `null` se a tabela não existir.
 */
export async function historicoDe(entidade: string, id: string): Promise<EntradaDoHistorico[] | null> {
  let q = supabaseAdmin().from("acoes_da_equipa").select(COLUNAS);
  q = entidade === "pedido"
    ? q.or(`and(entidade.eq.pedido,entidade_id.eq.${id}),detalhe->>servicoId.eq.${id}`)
    : q.eq("entidade", entidade).eq("entidade_id", id);
  const { data, error } = await q.order("criado_em", { ascending: false }).limit(100);
  if (error) {
    if (isMissingTable(error, "acoes_da_equipa")) return null;
    throw new Error(error.message);
  }
  return data as EntradaDoHistorico[];
}

/** As últimas ações de toda a equipa (o feed de Configurações › Atividade). */
export async function ultimasAcoes(limite = 200): Promise<EntradaDoHistorico[] | null> {
  const { data, error } = await supabaseAdmin().from("acoes_da_equipa")
    .select(COLUNAS).order("criado_em", { ascending: false }).limit(limite);
  if (error) {
    if (isMissingTable(error, "acoes_da_equipa")) return null;
    throw new Error(error.message);
  }
  return data as EntradaDoHistorico[];
}

