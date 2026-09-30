import { NextResponse } from "next/server";
import { verificarChave } from "../../_lib/webhookAuth";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { logCronRun } from "../../_lib/cronlog";
import { avisar, PUSH_CONFIGURADO } from "@/lib/push";
import { juntar, apenasNovos, memoriaAtualizada, type Pendente } from "@/lib/avisosPendentes";
import { avisosDeServicos, avisosDeDocumentos, type DocumentoParaAviso } from "@/lib/avisosOperacao";
import { fetchAllLaravelServices, servicesFromLaravel } from "../../_lib/laravelServices";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";

/**
 * Avisa quem gere a Piquet do que está à espera.
 *
 * ATENÇÃO AO HORÁRIO NO vercel.json: está DIÁRIO, e devia ser de 15 em 15
 * minutos. Não é escolha — o plano Hobby da Vercel recusa qualquer expressão
 * que corra mais do que uma vez por dia, e recusa o DEPLOY INTEIRO, não só o
 * cron. Um aviso por dia sobre um pedido urgente serve de pouco: isto fica a
 * meio caminho até ser chamado de fora (GitHub Actions ou o scheduler do
 * Laravel, ambos sem custo) ou até o plano mudar.
 *
 * A função em si está certa para a frequência alta — daí a memória do que já
 * foi avisado e o agrupamento num aviso só.
 *
 * Só avisa entre as 8h e as 21h. Fora disso não avisa: um telemóvel a vibrar
 * às 3 da manhã por causa de um ticket não resolve o ticket e ensina a pessoa
 * a desligar isto.
 *
 * Só avisa do que é NOVO desde o último aviso, e junta tudo numa notificação
 * só — ver lib/avisosPendentes.ts, onde está a regra e os testes.
 *
 * Avisa de quatro coisas: tickets por responder, pedidos por contactar,
 * serviços que ficaram concluídos ou agendados, e documentos que os técnicos
 * submeteram. As duas últimas vêm do Laravel e a regra está em
 * lib/avisosOperacao.ts.
 *
 * Nos serviços, o estado e o valor vão no TÍTULO e não no corpo: com várias
 * novidades a notificação mostra só os títulos, e o valor desaparecia
 * justamente nos dias com movimento.
 */

export const dynamic = "force-dynamic";

/** Entre as 8h e as 21h, hora de Lisboa. */
function dentroDeHoras(agora = new Date()): boolean {
  const h = Number(
    new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", hour12: false, timeZone: "Europe/Lisbon" }).format(agora),
  );
  return h >= 8 && h < 21;
}

/** A memória do que já foi avisado vive numa linha de `app_state`. */
const CHAVE_MEMORIA = "avisos_push_ja_enviados";

async function lerMemoria(): Promise<string[]> {
  const { data } = await supabaseAdmin().from("app_state").select("valor").eq("chave", CHAVE_MEMORIA).maybeSingle();
  const v = (data as { valor?: unknown } | null)?.valor;
  return Array.isArray(v) ? (v as string[]) : [];
}

async function gravarMemoria(ids: string[]): Promise<void> {
  await supabaseAdmin().from("app_state").upsert({ chave: CHAVE_MEMORIA, valor: ids }, { onConflict: "chave" });
}

/*
  A urgência de um pedido NÃO é uma coluna: vem escrita no texto, num campo
  "Urgência:" que a landing preenchia. A mesma regra do ecrã de pedidos
  (parseLeadMessage em leads/page.tsx) -- se divergissem, o aviso dizia
  urgente e o ecrã não, ou ao contrário.

  Selecionar uma coluna `urgency` inexistente faria a consulta devolver 400 e
  os pedidos desapareciam dos avisos em silêncio.
*/
function ehUrgente(mensagem: string): boolean {
  const campo = mensagem.match(/urg[êe]ncia:\s*([^\n·]+)/i)?.[1] ?? "";
  return /urgente|hoje|emerg|imediat|agora/i.test(campo);
}

/** A primeira linha do pedido é o serviço; é o que diz do que se trata. */
function resumoDoPedido(mensagem: string): string {
  const servico = mensagem.match(/servi[çc]o:\s*([^·\n]+)/i)?.[1]?.trim();
  return (servico || mensagem.replace(/\s+/g, " ").trim()).slice(0, 80);
}

/** O que está pendente agora, nas fontes que o backoffice já lê. */
async function recolherPendentes(): Promise<Pendente[]> {
  const db = supabaseAdmin();
  const pendentes: Pendente[] = [];

  // 1. Tickets de suporte por responder.
  const { data: tickets } = await db
    .from("support_tickets")
    .select("id, subject, requester_name, requester_type, status")
    .in("status", ["novo", "em_curso"]);

  for (const t of (tickets ?? []) as Array<Record<string, string>>) {
    if (t.status !== "novo") continue; // "em_curso" já teve resposta.
    pendentes.push({
      id: `ticket:${t.id}`,
      titulo: `Ticket de ${t.requester_type === "tecnico" ? "técnico" : "cliente"}`,
      corpo: `${t.requester_name || "Alguém"}: ${t.subject || "(sem assunto)"}`,
      url: `/suporte?ticket=${t.id}`,
    });
  }

  // 2. Pedidos recebidos que ainda ninguém contactou.
  const { data: leads } = await db
    .from("leads")
    .select("id, name, message, stage")
    .eq("stage", "novo");

  for (const l of (leads ?? []) as Array<Record<string, string>>) {
    pendentes.push({
      id: `lead:${l.id}`,
      titulo: ehUrgente(l.message ?? "") ? "Pedido URGENTE por responder" : "Pedido por responder",
      corpo: `${l.name || "Alguém"}: ${resumoDoPedido(l.message ?? "")}`,
      url: `/leads?lead=${l.id}`,
    });
  }

  // 3. Serviços concluídos e agendados, e documentos submetidos.
  pendentes.push(...(await recolherServicos()));
  pendentes.push(...(await recolherDocumentos()));

  return pendentes;
}

/**
 * Serviços, da fonte que estiver ligada.
 *
 * Quando o Laravel está ligado é ele a fonte real; caso contrário lê-se o
 * Supabase, que é onde vivem os serviços registados à mão. As duas dão a
 * mesma forma a `avisosDeServicos`, que é onde está a regra e os testes.
 *
 * Uma falha aqui NÃO pode calar os avisos de tickets e pedidos que já
 * funcionavam -- daí o try/catch por fonte em vez de um à volta de tudo.
 */
async function recolherServicos(): Promise<Pendente[]> {
  try {
    if (servicesFromLaravel()) {
      const todos = await fetchAllLaravelServices();
      return avisosDeServicos(todos);
    }

    const { data } = await supabaseAdmin()
      .from("services")
      .select("id, status, customer_name, service_name, city, total_customer_value, scheduled_at, completed_at, requested_at")
      .in("status", ["concluido", "agendado"]);

    return avisosDeServicos(
      ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        status: String(r.status ?? ""),
        customerName: (r.customer_name as string) ?? undefined,
        serviceName: (r.service_name as string) ?? undefined,
        city: (r.city as string) ?? undefined,
        totalCustomerValue: Number(r.total_customer_value) || 0,
        scheduledAt: (r.scheduled_at as string) ?? undefined,
        completedAt: (r.completed_at as string) ?? undefined,
        requestedAt: (r.requested_at as string) ?? undefined,
      })),
    );
  } catch (e) {
    console.error("[cron avisos] serviços:", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Documentos que os técnicos submeteram e ainda ninguém validou.
 *
 * Só existem no Laravel. O `per_page` do controlador está travado em 100 --
 * foi assim que a Danúbia ficou com um documento inalcançável -- por isso
 * percorrem-se as páginas em vez de se pedir um número grande e acreditar.
 */
async function recolherDocumentos(): Promise<Pendente[]> {
  if (!LARAVEL_ADMIN_ENABLED) return [];

  interface Resposta {
    items: Array<{
      id: number; vendor_name: string | null; document_type: string | null;
      status: string; created_at: string | null;
    }>;
    meta?: { last_page?: number };
  }

  try {
    const todos: DocumentoParaAviso[] = [];
    let pagina = 1;
    let ultima = 1;

    do {
      const r = await laravelAdminRequest<Resposta>(
        `/v1/admin/vendor-documents?status=pending&per_page=100&page=${pagina}`,
      );
      const itens = r.items ?? [];
      todos.push(...itens.map((d) => ({
        id: d.id,
        vendorName: d.vendor_name,
        documentType: d.document_type,
        status: d.status,
        createdAt: d.created_at,
      })));
      ultima = r.meta?.last_page ?? (itens.length === 100 ? pagina + 1 : pagina);
      pagina++;
    } while (pagina <= ultima && pagina <= 20);

    return avisosDeDocumentos(todos);
  } catch (e) {
    console.error("[cron avisos] documentos:", e instanceof Error ? e.message : e);
    return [];
  }
}

export async function GET(req: Request) {
  const auth = verificarChave(
    req.headers.get("authorization")?.replace(/^Bearer /, "") ?? null,
    process.env.CRON_SECRET,
    "CRON_SECRET",
  );
  if (!auth.ok) {
    console.error("[cron avisos] recusado:", auth.motivo);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ error: "supabase off" }, { status: 503 });
  }
  if (!PUSH_CONFIGURADO) {
    // Não é erro: é o estado antes de as chaves existirem.
    await logCronRun("avisos", true, "sem chaves VAPID");
    return NextResponse.json({ ok: true, nota: "sem chaves VAPID" });
  }
  if (!dentroDeHoras()) {
    await logCronRun("avisos", true, "fora de horas");
    return NextResponse.json({ ok: true, nota: "fora de horas" });
  }

  try {
    const pendentes = await recolherPendentes();
    const memoria = await lerMemoria();
    const novos = apenasNovos(pendentes, memoria);
    const aviso = juntar(novos);

    /*
      A memória grava-se SEMPRE, mesmo quando não há nada novo: é assim que
      o que já foi resolvido sai da lista e que uma coisa que volte a
      aparecer volte a avisar.
    */
    await gravarMemoria(memoriaAtualizada(pendentes, memoria));

    if (!aviso) {
      await logCronRun("avisos", true, `${pendentes.length} pendentes, nada novo`);
      return NextResponse.json({ ok: true, pendentes: pendentes.length, novos: 0 });
    }

    const r = await avisar(aviso);
    await logCronRun("avisos", r.erros.length === 0, `${novos.length} novos → ${r.enviados} dispositivos`);

    return NextResponse.json({ ok: true, pendentes: pendentes.length, novos: novos.length, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    await logCronRun("avisos", false, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
