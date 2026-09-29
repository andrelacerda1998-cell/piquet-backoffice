import { NextResponse } from "next/server";
import { verificarChave } from "../../_lib/webhookAuth";
import { SUPABASE_ENABLED } from "@/lib/supabase/server";
import { sincronizarTelefonesTecnicos } from "@/lib/tecnicoContactos";
import { logCronRun } from "../../_lib/cronlog";

/**
 * Cron diário: copia do Laravel o nome, o telefone e o ofício dos técnicos.
 *
 * Servia o webhook do WhatsApp, que saiu com a Cloud API. O que continua a
 * valer é a cópia em si: o token do Laravel só existe no servidor, e sem ela
 * não há forma de responder a "quem faz canalização" -- que é o que permite
 * falar com um grupo de técnicos de uma vez.
 *
 * Um técnico novo, ou um que mudou de número ou de ofício, entra aqui no dia
 * seguinte.
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
    await logCronRun(
      "technician-phones",
      true,
      // O que saiu conta tanto como o que entrou: é a única pista de que um
      // técnico foi apagado no Laravel.
      r.removidos > 0
        ? `${r.guardados} técnicos com ofício · ${r.removidos} removidos`
        : `${r.guardados} técnicos com ofício`,
      r.guardados,
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    await logCronRun("technician-phones", false, motivo, 0);
    return NextResponse.json({ ok: false, error: motivo }, { status: 502 });
  }
}
