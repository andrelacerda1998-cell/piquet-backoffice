import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { servicesFromLaravel, type LaravelServiceRow } from "./laravelServices";
import { resolveCategoryId } from "@/lib/categories";
import type { LeadStageId } from "@/lib/leadStages";

/**
 * Traz para o backoffice os pedidos feitos na app.
 *
 * O cliente pede na app, o pedido fica no Laravel, e o ecrã de Pedidos só
 * conhecia o que entrava pelo formulário do site e pelo WhatsApp. Com o
 * formulário a sair da landing, sem isto o backoffice deixava de saber que
 * alguém tinha pedido alguma coisa.
 *
 * É uma cópia, não uma migração: a verdade do serviço continua a ser o Laravel
 * -- é lá que o cliente paga, que o técnico aceita e que o serviço fecha. Aqui
 * fica o que o backoffice precisa para o mostrar ao lado dos outros pedidos, e
 * para as regras de alerta e a conversa de WhatsApp funcionarem sobre ele.
 */

/**
 * Estado do serviço no Laravel → estado do pedido.
 *
 * `Pending` é um pedido criado e ainda sem ninguém a ser perguntado; `Matching`
 * é a procura a decorrer. São coisas diferentes para quem despacha e por isso
 * não caem no mesmo estado.
 *
 * `MatchingFailed` dá "perdido" com a mesma cara de um cancelamento, mas o
 * motivo fica registado: não houve técnico, ninguém desistiu.
 */
const ESTADO: Record<string, LeadStageId> = {
  Pending: "novo",
  Matching: "a_procurar",
  MatchingFailed: "perdido",
  Accepted: "com_tecnico",
  AwaitingPayment: "com_tecnico",
  Pending3DS: "com_tecnico",
  ClosedPendingPayment: "com_tecnico",
  Closed: "concluido",
  Finished: "concluido",
  Canceled: "perdido",
  Refused: "perdido",
};

const MOTIVO_PERDA: Record<string, string> = {
  MatchingFailed: "sem_tecnico",
  Canceled: "desistiu",
  Refused: "sem_tecnico",
};

export interface ResultadoSync {
  lidos: number;
  criados: number;
  atualizados: number;
  ignorados: number;
  erro?: string;
}

/**
 * A mensagem do pedido, no mesmo formato que o resto do backoffice já lê.
 *
 * Não é enfeite: `extrairDadosLead` e `categoryFromMessage` procuram
 * "Servico:" e "Descrição:" para montar o texto que vai aos técnicos e para
 * deduzir a categoria. Escrever noutro formato obrigaria a um segundo
 * caminho de leitura só para os pedidos da app.
 */
function montarMensagem(r: LaravelServiceRow): string {
  const linhas = [`Servico: ${r.service_name || r.category_name || "Por identificar"}`];
  const notas = (r as { customer_notes?: string | null }).customer_notes?.trim();
  return notas ? `${linhas[0]}\n${notas}` : linhas[0];
}

/**
 * Sincroniza, mas só se a última já tiver algum tempo.
 *
 * A conta da Vercel é Hobby e os crons são limitados a uma vez por dia -- um
 * pedido de canalização feito às 9h não pode esperar até à manhã seguinte para
 * alguém saber que existe. Por isso a sincronização também acontece quando
 * alguém abre a lista de Pedidos: quem está a olhar para o backoffice vê os
 * pedidos de agora, e o cron diário fica como rede de segurança para quando
 * ninguém abre.
 *
 * O intervalo evita que cada carregamento da página chame o Laravel. Usa-se o
 * registo dos crons, que já existe, em vez de mais uma tabela de estado.
 */
export async function sincronizarSeVelho(minutos = 3): Promise<ResultadoSync | null> {
  if (!servicesFromLaravel()) return null;
  try {
    const { data } = await supabaseAdmin()
      .from("cron_runs").select("created_at")
      .eq("job", "app-requests")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const ultima = (data as { created_at: string } | null)?.created_at;
    if (ultima && Date.now() - Date.parse(ultima) < minutos * 60_000) return null;
  } catch {
    // Sem registo não se sabe quando foi a última: sincroniza.
  }

  const r = await sincronizarPedidosDaApp();
  try {
    await supabaseAdmin().from("cron_runs").insert({
      job: "app-requests", ok: !r.erro,
      detail: (r.erro ?? `${r.criados} novos · ${r.atualizados} actualizados`).slice(0, 900),
      upserted: r.criados + r.atualizados,
    });
  } catch { /* o registo é conveniência, não pode travar a listagem */ }
  return r;
}

export async function sincronizarPedidosDaApp(limite = 100): Promise<ResultadoSync> {
  const vazio: ResultadoSync = { lidos: 0, criados: 0, atualizados: 0, ignorados: 0 };
  if (!servicesFromLaravel()) {
    return { ...vazio, erro: "LARAVEL_SERVICES_ENABLED não está ligado." };
  }

  let itens: LaravelServiceRow[] = [];
  try {
    const r = await laravelAdminRequest<{ items: LaravelServiceRow[] }>(
      `/v1/admin/services?per_page=${limite}`,
    );
    itens = r.items ?? [];
  } catch (e) {
    return { ...vazio, erro: e instanceof Error ? e.message : "Falha ao ler os serviços." };
  }

  const db = supabaseAdmin();
  const res: ResultadoSync = { ...vazio, lidos: itens.length };

  // Quais já cá estão. Uma leitura só, em vez de uma por serviço.
  const ids = itens.map((r) => String(r.id));
  const { data: existentes } = await db
    .from("leads").select("id, laravel_service_id, stage").in("laravel_service_id", ids);
  const porServico = new Map(
    ((existentes ?? []) as { id: string; laravel_service_id: string; stage: string }[])
      .map((l) => [l.laravel_service_id, l]),
  );

  for (const r of itens) {
    const estadoLaravel = String(r.status ?? "");
    const stage = ESTADO[estadoLaravel];
    if (!stage) { res.ignorados++; continue; }

    const nome = (r.customer_name ?? "").trim();
    const telefone = ((r as { customer_phone?: string | null }).customer_phone ?? "").trim();
    if (!nome && !telefone) { res.ignorados++; continue; }

    const linha: Record<string, unknown> = {
      laravel_service_id: String(r.id),
      name: nome,
      phone: telefone,
      city: (r.city ?? "").trim(),
      message: montarMensagem(r),
      source: "app",
      stage,
      technician_name: (r.technician_name ?? "").trim(),
      quote_value: r.total_customer_value ?? null,
      technician_value: r.technician_value ?? null,
    };
    const categoria = resolveCategoryId(r.category_name ?? r.service_name);
    if (categoria) linha.category_id = categoria;
    if (MOTIVO_PERDA[estadoLaravel]) linha.loss_reason = MOTIVO_PERDA[estadoLaravel];

    const ja = porServico.get(String(r.id));
    if (ja) {
      /*
        Só se actualiza o que vem do Laravel. As notas internas, o motivo de
        perda escrito à mão e a conversa de WhatsApp são trabalho feito aqui e
        não podem ser apagados por uma sincronização.
      */
      const { error } = await db.from("leads").update(linha).eq("id", ja.id);
      if (!error) res.atualizados++;
    } else {
      const { error } = await db.from("leads").insert({ ...linha, created_at: r.requested_at ?? undefined });
      if (!error) res.criados++;
    }
  }

  return res;
}
