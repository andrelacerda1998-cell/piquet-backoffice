import { NextResponse } from "next/server";
import { verificarChave } from "../../_lib/webhookAuth";
import { SUPABASE_ENABLED } from "@/lib/supabase/server";
import { sincronizarTelefonesTecnicos } from "@/lib/tecnicoContactos";
import { logCronRun } from "../../_lib/cronlog";

/**
 * Cron diário: copia do Laravel os números de telefone dos técnicos.
 *
 * É desta cópia que o webhook do WhatsApp depende para saber se quem escreve é
 * cliente ou alguém da rede. Sem ela actualizada, um técnico novo escreve e
 * entra no CRM como se fosse um pedido de serviço -- e um técnico que mudou de
 * número deixa de ser reconhecido.
 *
 * A difusão de pedidos também a actualiza, porque já lê a lista toda. Este
 * cron existe para os dias em que ninguém despacha nada.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verificarChave(
    req.headers.get("authorization")?.replace(/^Bearer /, "") ?? null,
    process.env.CRON_SECRET,
    "CRON_SECRET",
  );
  if (!auth.ok) {
    console.error("[cron] recusado:", auth.motivo);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ error: "supabase não configurado" }, { status: 503 });
  }

  try {
    const r = await sincronizarTelefonesTecnicos();
    await logCronRun("technician-phones", true, `${r.guardados} números`, r.guardados);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    await logCronRun("technician-phones", false, motivo, 0);
    return NextResponse.json({ ok: false, error: motivo }, { status: 502 });
  }
}
