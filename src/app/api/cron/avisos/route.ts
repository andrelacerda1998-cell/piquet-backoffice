import { NextResponse } from "next/server";
import { verificarChave } from "../../_lib/webhookAuth";
import { supabaseAdmin, SUPABASE_ENABLED } from "@/lib/supabase/server";
import { logCronRun } from "../../_lib/cronlog";
import { avisar, PUSH_CONFIGURADO } from "@/lib/push";
import { juntar, apenasNovos, memoriaAtualizada, type Pendente } from "@/lib/avisosPendentes";

/**
 * Avisa quem gere a Piquet do que está à espera.
 *
 * De 15 em 15 minutos, durante o horário em que alguém pode fazer alguma
 * coisa. Fora dele não avisa: um telemóvel a vibrar às 3 da manhã por causa
 * de um ticket não resolve o ticket e ensina a pessoa a desligar isto.
 *
 * Só avisa do que é NOVO desde o último aviso, e junta tudo numa notificação
 * só — ver lib/avisosPendentes.ts, onde está a regra e os testes.
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
    .select("id, name, message, stage, urgency")
    .eq("stage", "novo");

  for (const l of (leads ?? []) as Array<Record<string, string>>) {
    pendentes.push({
      id: `lead:${l.id}`,
      titulo: l.urgency === "urgente" ? "Pedido URGENTE por responder" : "Pedido por responder",
      corpo: `${l.name || "Alguém"}: ${(l.message || "").slice(0, 80)}`,
      url: `/leads?lead=${l.id}`,
    });
  }

  return pendentes;
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
