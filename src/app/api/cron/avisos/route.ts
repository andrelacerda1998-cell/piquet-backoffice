import { NextResponse } from "next/server";
import { verificarChave } from "../../_lib/webhookAuth";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { logCronRun } from "../../_lib/cronlog";
import { avisar, PUSH_CONFIGURADO, type Aviso } from "@/lib/push";
import { juntar, apenasNovos, memoriaAtualizada, type Pendente } from "@/lib/avisosPendentes";
import {
  avisosDeServicos, avisosDeDocumentos, avisosDeWorkspace, ultimasDatas,
  type DocumentoParaAviso, type TecnicoParaAviso,
} from "@/lib/avisosOperacao";
import { fetchAllLaravelServices, servicesFromLaravel } from "../../_lib/laravelServices";
import { laravelAdminRequest, LARAVEL_ADMIN_ENABLED } from "@/lib/laravelAdmin";

/**
 * Avisa quem gere a Piquet do que está à espera.
 *
 * QUEM CHAMA ISTO: uma GitHub Action, de 15 em 15 minutos
 * (.github/workflows/avisos.yml). Não é excentricidade — o plano Hobby da
 * Vercel recusa qualquer cron mais frequente do que diário, e recusa o DEPLOY
 * INTEIRO, não só o cron. Um aviso por dia sobre um serviço concluído deixa
 * de ser aviso e passa a ser relatório da véspera.
 *
 * A entrada no vercel.json fica na mesma, uma vez por dia: é a rede de
 * segurança para o dia em que a Action falhar ou o segredo expirar. Chamar
 * duas vezes não duplica nada — a memória do que já foi avisado trata disso.
 *
 * A função está escrita para frequência alta — daí a memória do que já foi
 * avisado e o agrupamento num aviso só.
 *
 * Só avisa entre as 8h e as 21h. Fora disso não avisa: um telemóvel a vibrar
 * às 3 da manhã por causa de um ticket não resolve o ticket e ensina a pessoa
 * a desligar isto.
 *
 * Só avisa do que é NOVO desde o último aviso, e junta tudo numa notificação
 * só — ver lib/avisosPendentes.ts, onde está a regra e os testes.
 *
 * Avisa de cinco coisas: tickets por responder, pedidos por contactar,
 * serviços que ficaram concluídos ou agendados, documentos que os técnicos
 * submeteram, e técnicos à espera do workspace de faturação. As três últimas
 * vêm do Laravel e as regras estão em lib/avisosOperacao.ts.
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
async function recolherPendentes(): Promise<{
  pendentes: Pendente[]; fonteServicos: string; faturacao: string;
}> {
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
  const servicos = await recolherServicos();
  pendentes.push(...servicos.avisos);
  pendentes.push(...(await recolherDocumentos()));

  const workspaces = await recolherWorkspaces();
  pendentes.push(...workspaces.avisos);

  return { pendentes, fonteServicos: servicos.fonte, faturacao: workspaces.retrato };
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
async function recolherServicos(): Promise<{ avisos: Pendente[]; fonte: string }> {
  try {
    if (servicesFromLaravel()) {
      const todos = await fetchAllLaravelServices();
      /*
        A data do último concluído vai para o registo porque "não há avisos
        porque não aconteceu nada" e "não há avisos porque nenhum serviço é
        reconhecido como concluído" são indistinguíveis de fora. Com a
        contagem ao lado, uma linha responde às duas.
      */
      const d = ultimasDatas(todos);
      const dia = (iso: string | null) => (iso ? iso.slice(0, 10) : "nenhum");
      return {
        avisos: avisosDeServicos(todos),
        fonte: `laravel (${todos.length}) · concluídos ${d.contagem.concluido}, últ. ${dia(d.concluido)}`
             + ` · agendados ${d.contagem.agendado}, últ. ${dia(d.agendado)}`,
      };
    }

    const { data } = await supabaseAdmin()
      .from("services")
      .select("id, status, customer_name, service_name, city, total_customer_value, scheduled_at, completed_at, requested_at")
      .in("status", ["concluido", "agendado"]);

    const linhas = (data ?? []) as Array<Record<string, unknown>>;
    return { fonte: `supabase (${linhas.length})`, avisos: avisosDeServicos(
      linhas.map((r) => ({
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
    ) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron avisos] serviços:", msg);
    /*
      A fonte vai para o registo da corrida porque "zero serviços" e "a
      leitura rebentou" dão exatamente o mesmo resultado visto de fora -- e
      passei tempo a tentar distinguir os dois sem nada que os separasse.
    */
    return { avisos: [], fonte: `erro: ${msg.slice(0, 80)}` };
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

/**
 * Um aviso de exemplo, para se ver como fica no telemóvel.
 *
 * Existe porque a alternativa era pior: para ver um aviso de serviço
 * concluído sem haver nenhum, teria de se inventar um serviço na base de
 * dados de produção -- e um serviço falso de 85 € entra no GMV e no
 * Financeiro. Aqui não se escreve nada: o serviço vive só nesta função.
 *
 * Passa pelo MESMO `avisosDeServicos` que formata os reais, senão não
 * provava nada sobre o que se vai receber de facto.
 *
 * O corpo diz "exemplo" de propósito. O título fica igual ao verdadeiro,
 * que é o que se quer ver, mas alguém que receba isto tem de conseguir
 * perceber que não há serviço nenhum à espera.
 */
function avisoDeExemplo(): Aviso | null {
  const agora = new Date();
  const [p] = avisosDeServicos(
    [{
      id: "exemplo",
      status: "concluido",
      serviceName: "Reparação de canalização",
      city: "Porto",
      totalCustomerValue: 85,
      completedAt: agora.toISOString(),
    }],
    { agora },
  );
  if (!p) return null;
  // Tag própria: não se mistura nem apaga os avisos verdadeiros.
  return { titulo: p.titulo, corpo: `${p.corpo} · exemplo`, url: "/servicos", tag: "exemplo" };
}

/** Percentagem com uma casa, à portuguesa. */
function pct(n: number, total: number): string {
  if (total <= 0) return "—";
  return `${(Math.round((n / total) * 1000) / 10).toString().replace(".", ",")}%`;
}

/**
 * Técnicos que já entregaram o acesso à AT e esperam pelo workspace.
 *
 * O workspace de faturação é criado pela equipa da Piquet, não pelo técnico —
 * e sem ele o técnico não pode ficar online. Ele faz a parte dele e fica
 * parado à espera de alguém que não sabe que está à espera. É o mesmo buraco
 * dos documentos submetidos, noutro sítio do mesmo funil.
 *
 * A regra e os testes estão em lib/avisosOperacao.ts. Aqui só se vão buscar
 * as páginas: o controlador do Laravel trava o `per_page` em 100, a mesma
 * lição dos documentos.
 */
async function recolherWorkspaces(): Promise<{ avisos: Pendente[]; retrato: string }> {
  if (!LARAVEL_ADMIN_ENABLED) return { avisos: [], retrato: "laravel desligado" };

  interface Resposta {
    items: Array<{
      id: number; name: string | null; at_user?: string | null;
      invoice_workspace?: string | null; account_blocker?: string | null;
      can_accept_service?: boolean;
    }>;
    meta?: { last_page?: number };
  }

  try {
    const todos: TecnicoParaAviso[] = [];
    let pagina = 1;
    let ultima = 1;

    do {
      const r = await laravelAdminRequest<Resposta>(`/v1/admin/vendors?per_page=100&page=${pagina}`);
      const itens = r.items ?? [];
      todos.push(...itens.map((v) => ({
        id: v.id,
        nome: v.name,
        atUser: v.at_user,
        invoiceWorkspace: v.invoice_workspace,
        blocker: v.account_blocker,
        podeAceitar: v.can_accept_service,
      })));
      ultima = r.meta?.last_page ?? (itens.length === 100 ? pagina + 1 : pagina);
      pagina++;
    } while (pagina <= ultima && pagina <= 20);

    /*
      O retrato da faturação vai para o registo da corrida pela mesma razão
      que o dos serviços: "quantos técnicos podem faturar?" não tinha resposta
      em lado nenhum sem abrir o backoffice com sessão iniciada. Esta linha
      responde a cada corrida, e fica visível em Integrações.
    */
    const temAT = (t: TecnicoParaAviso) => (t.atUser ?? "").includes("/");

    const comWorkspace = todos.filter((t) => t.invoiceWorkspace).length;
    const bloqueados = todos.filter((t) => !t.invoiceWorkspace && temAT(t) && t.blocker).length;
    /*
      As mesmas contagens que a rota /technicians/funil mostra no ecrã, e
      calculadas da mesma maneira de propósito: se divergissem, o registo e o
      ecrã diziam números diferentes sobre a mesma coisa e ninguém saberia
      qual acreditar.

      `podemAceitar` vem do Laravel (`can_accept_service`) e não é recontado
      aqui -- a autoridade é de lá.
    */
    /*
      Perfil completo = documentos validados E workspace criado.

      O Laravel não expõe `all_documents_verified` por técnico. Deriva-se do
      código de bloqueio, que devolve o PRIMEIRO problema pela ordem
      contactos → documentos → IBAN → morada: se chegou a `iban_missing` ou a
      `fiscal_address_missing`, os documentos já passaram. O `contact_unverified`
      tapa o resto, e esses contam-se à parte para a margem ficar à vista.
    */
    const docsValidados = (t: TecnicoParaAviso) =>
      !t.blocker || t.blocker === "iban_missing" || t.blocker === "fiscal_address_missing";

    const perfilCompleto = todos.filter((t) => docsValidados(t) && t.invoiceWorkspace).length;
    const porClassificar = todos.filter((t) => t.blocker === "contact_unverified").length;
    const soFaltaAT = todos.filter((t) => !t.blocker && !temAT(t)).length;
    const podemAceitar = todos.filter((t) => t.podeAceitar).length;
    const avisos = avisosDeWorkspace(todos);

    return {
      avisos,
      retrato: `${todos.length} registados`
             + ` · ${podemAceitar} podem aceitar (${pct(podemAceitar, todos.length)})`
             + ` · ${perfilCompleto} perfil completo (${pct(perfilCompleto, todos.length)})`
             + ` · ${comWorkspace} podem faturar · ${soFaltaAT} só falta a AT`
             + ` · ${avisos.length} à espera · ${bloqueados} com algo em falta`
             + (porClassificar > 0 ? ` · ${porClassificar} por classificar` : ""),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron avisos] workspaces:", msg);
    return { avisos: [], retrato: `erro: ${msg.slice(0, 60)}` };
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
  /*
    ?exemplo=1 manda um aviso de demonstração e sai. Fica ANTES da janela de
    horas e antes de tudo o resto: quem pede um exemplo quer vê-lo agora, e
    não deve mexer na memória do que já foi avisado -- senão um teste fazia
    desaparecer avisos verdadeiros.
  */
  if (new URL(req.url).searchParams.get("exemplo")) {
    const aviso = avisoDeExemplo();
    if (!aviso) return NextResponse.json({ error: "não foi possível montar o exemplo" }, { status: 500 });
    const r = await avisar(aviso);
    await logCronRun("avisos", r.erros.length === 0, `exemplo → ${r.enviados} dispositivos`);
    return NextResponse.json({ ok: true, exemplo: aviso, ...r });
  }

  if (!dentroDeHoras()) {
    await logCronRun("avisos", true, "fora de horas");
    return NextResponse.json({ ok: true, nota: "fora de horas" });
  }

  try {
    const { pendentes, fonteServicos, faturacao } = await recolherPendentes();
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
      await logCronRun("avisos", true, `${pendentes.length} pendentes, nada novo · serviços: ${fonteServicos} · faturação: ${faturacao}`);
      return NextResponse.json({ ok: true, pendentes: pendentes.length, novos: 0, fonteServicos, faturacao });
    }

    const r = await avisar(aviso);
    await logCronRun("avisos", r.erros.length === 0, `${novos.length} novos → ${r.enviados} dispositivos · serviços: ${fonteServicos} · faturação: ${faturacao}`);

    return NextResponse.json({ ok: true, pendentes: pendentes.length, novos: novos.length, fonteServicos, faturacao, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    await logCronRun("avisos", false, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
