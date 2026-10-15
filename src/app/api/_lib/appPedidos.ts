import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { servicesFromLaravel, type LaravelServiceRow } from "./laravelServices";
import { resolveCategoryId } from "@/lib/categories";
import type { LeadStageId } from "@/lib/leadStages";
import type { LeadLossReasonId } from "@/lib/leadLossReasons";

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
  // Pedido personalizado à espera de o backoffice definir tempo e categorias.
  PendingReview: "novo",
  Matching: "a_procurar",
  MatchingFailed: "perdido",
  Accepted: "com_tecnico",
  Scheduled: "com_tecnico",
  Arrived: "com_tecnico",
  AwaitingPayment: "com_tecnico",
  Pending3DS: "com_tecnico",
  ClosedPendingPayment: "com_tecnico",
  Closed: "concluido",
  Finished: "concluido",
  Canceled: "perdido",
  Refused: "perdido",
  Archived: "perdido",
  // O pagamento não chegou a acontecer: o pedido morreu no checkout.
  RefusedMbway: "perdido",
  ExpiredMbway: "perdido",
  CanceledMbway: "perdido",
  Expired3DS: "perdido",
};

/**
 * O motivo da perda, da lista fechada do CRM (lib/leadLossReasons), e uma nota
 * quando "outro" não diz o suficiente. Era "desistiu" no cancelamento, que
 * não está na lista: o ecrã mostrava o motivo em branco.
 */
const MOTIVO_PERDA: Record<string, { motivo: LeadLossReasonId; nota?: string }> = {
  MatchingFailed: { motivo: "sem_tecnico" },
  Refused: { motivo: "sem_tecnico" },
  Canceled: { motivo: "outro", nota: "Cancelado na app" },
  Archived: { motivo: "outro", nota: "Arquivado no backoffice" },
  RefusedMbway: { motivo: "outro", nota: "MB Way recusado pelo cliente" },
  ExpiredMbway: { motivo: "outro", nota: "MB Way não confirmado a tempo" },
  CanceledMbway: { motivo: "outro", nota: "Cancelou no ecrã do MB Way" },
  Expired3DS: { motivo: "outro", nota: "Cartão sem a confirmação 3DS" },
};

export interface ResultadoSync {
  lidos: number;
  criados: number;
  atualizados: number;
  ignorados: number;
  /*
    Porque foram ignorados. Sem isto, "0 novos" tanto pode querer dizer que
    não há nada de novo como que se descartou tudo em silêncio -- e foi
    exactamente essa dúvida que apareceu na primeira leitura real.
  */
  semEstado: number;
  semContacto: number;
  /**
   * Os que o Supabase recusou gravar, e o primeiro motivo. Contavam-se só os
   * que gravavam: com duas colunas por migrar, 71 de 100 falhavam sem que
   * nada o dissesse (15/10/2026).
   */
  falhados: number;
  primeiraFalha?: string;
  /** Quantos serviços o Laravel diz ter no total, além da página lida. */
  total?: number;
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
/** Uma linha que diz o que aconteceu a TODOS os serviços lidos, não só aos guardados. */
export function resumo(r: ResultadoSync): string {
  const partes = [
    `${r.lidos} lidos${r.total != null && r.total !== r.lidos ? ` de ${r.total}` : ""}`,
    `${r.criados} novos`,
    `${r.atualizados} actualizados`,
  ];
  if (r.semEstado) partes.push(`${r.semEstado} com estado desconhecido`);
  if (r.semContacto) partes.push(`${r.semContacto} sem nome nem telefone`);
  if (r.falhados) partes.push(`${r.falhados} falharam ao gravar${r.primeiraFalha ? ` (${r.primeiraFalha})` : ""}`);
  return partes.join(" · ");
}

/** Correu bem só se leu e gravou tudo: uma gravação falhada também é falha. */
export function correuBem(r: ResultadoSync): boolean {
  return !r.erro && r.falhados === 0;
}

export async function sincronizarSeVelho(minutos = 3): Promise<ResultadoSync | null> {
  if (!servicesFromLaravel()) return null;
  try {
    const { data } = await supabaseAdmin()
      // A coluna chama-se `ran_at`, não `created_at`. Com o nome errado a
      // leitura falhava, o catch engolia o erro e o intervalo nunca travava
      // nada: chamava-se o Laravel a CADA carregamento da lista de pedidos.
      .from("cron_runs").select("ran_at")
      .eq("job", "app-requests")
      .order("ran_at", { ascending: false }).limit(1).maybeSingle();
    const ultima = (data as { ran_at: string } | null)?.ran_at;
    if (ultima && Date.now() - Date.parse(ultima) < minutos * 60_000) return null;
  } catch {
    // Sem registo não se sabe quando foi a última: sincroniza.
  }

  // Ao abrir a lista basta a primeira página (os mais recentes); a corrida
  // diária é que lê tudo.
  const r = await sincronizarPedidosDaApp({ paginas: 1 });
  try {
    await supabaseAdmin().from("cron_runs").insert({
      job: "app-requests", ok: correuBem(r),
      detail: (r.erro ?? resumo(r)).slice(0, 900),
      upserted: r.criados + r.atualizados,
    });
  } catch { /* o registo é conveniência, não pode travar a listagem */ }
  return r;
}

/** O Laravel não dá mais de 100 por página; 30 páginas chegam para 3000 pedidos. */
const POR_PAGINA = 100;
const MAXIMO_DE_PAGINAS = 30;

/**
 * @param paginas quantas páginas ler, das mais recentes para as mais antigas.
 *                Por omissão todas: lia-se só a primeira, e os pedidos para lá
 *                dos 100 mais recentes nunca chegavam aos Contactos.
 */
export async function sincronizarPedidosDaApp({ paginas = MAXIMO_DE_PAGINAS }: { paginas?: number } = {}): Promise<ResultadoSync> {
  const vazio: ResultadoSync = { lidos: 0, criados: 0, atualizados: 0, ignorados: 0, semEstado: 0, semContacto: 0, falhados: 0 };
  if (!servicesFromLaravel()) {
    return { ...vazio, erro: "LARAVEL_SERVICES_ENABLED não está ligado." };
  }

  const res: ResultadoSync = { ...vazio };
  const limite = Math.min(paginas, MAXIMO_DE_PAGINAS);

  for (let pagina = 1; pagina <= limite; pagina++) {
    let itens: LaravelServiceRow[];
    let ultima = 1;
    try {
      const r = await laravelAdminRequest<{ items: LaravelServiceRow[]; meta?: { total?: number; last_page?: number } }>(
        `/v1/admin/services?per_page=${POR_PAGINA}&page=${pagina}`,
      );
      itens = r.items ?? [];
      res.total = r.meta?.total;
      ultima = r.meta?.last_page ?? 1;
    } catch (e) {
      // A primeira página a falhar é erro; uma das seguintes deixa o que já
      // se gravou e diz onde parou.
      const motivo = e instanceof Error ? e.message : "Falha ao ler os serviços.";
      return { ...res, erro: pagina === 1 ? motivo : `parou na página ${pagina}: ${motivo}` };
    }

    res.lidos += itens.length;
    await gravarPagina(itens, res);
    if (pagina >= ultima || itens.length === 0) break;
  }

  return res;
}

async function gravarPagina(itens: LaravelServiceRow[], res: ResultadoSync): Promise<void> {
  const db = supabaseAdmin();

  // Quais já cá estão. Uma leitura por página, em vez de uma por serviço.
  const ids = itens.map((r) => String(r.id));
  const { data: existentes } = await db
    .from("leads").select("id, laravel_service_id, stage, loss_reason").in("laravel_service_id", ids);
  const porServico = new Map(
    ((existentes ?? []) as { id: string; laravel_service_id: string; stage: string; loss_reason: string | null }[])
      .map((l) => [l.laravel_service_id, l]),
  );

  const falhou = (error: { message?: string } | null) => {
    if (!error) return false;
    res.falhados++;
    res.primeiraFalha ??= error.message ?? "erro desconhecido";
    return true;
  };

  for (const r of itens) {
    const estadoLaravel = String(r.status ?? "");
    const stage = ESTADO[estadoLaravel];
    if (!stage) { res.ignorados++; res.semEstado++; continue; }

    const nome = (r.customer_name ?? "").trim();
    const telefone = ((r as { customer_phone?: string | null }).customer_phone ?? "").trim();
    if (!nome && !telefone) { res.ignorados++; res.semContacto++; continue; }

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

    const ja = porServico.get(String(r.id));
    /*
      O motivo da perda só se escreve quando ainda não há nenhum: o que a
      equipa escreveu à mão não pode ser apagado por uma sincronização (como
      as notas e a conversa de WhatsApp, que nem se tocam).
    */
    const perda = MOTIVO_PERDA[estadoLaravel];
    if (perda && !ja?.loss_reason) {
      linha.loss_reason = perda.motivo;
      if (perda.nota) linha.loss_note = perda.nota;
    }

    if (ja) {
      const { error } = await db.from("leads").update(linha).eq("id", ja.id);
      if (!falhou(error)) res.atualizados++;
    } else {
      const { error } = await db.from("leads").insert({ ...linha, created_at: r.requested_at ?? undefined });
      if (!falhou(error)) res.criados++;
    }
  }
}
