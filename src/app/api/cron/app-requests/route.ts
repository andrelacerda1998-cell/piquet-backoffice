import { NextResponse } from "next/server";
import { verificarChave } from "../../_lib/webhookAuth";
import { SUPABASE_ENABLED } from "@/lib/supabase/server";
import { sincronizarPedidosDaApp, resumo } from "../../_lib/appPedidos";
import { logCronRun } from "../../_lib/cronlog";

/**
 * Traz os pedidos feitos na app para o backoffice.
 *
 * De 15 em 15 minutos, e não uma vez por dia: um pedido de canalização não
 * espera pela manhã seguinte para alguém saber que existe. É a frequência mais
 * alta de todos os crons por essa razão.
 *
 * Idempotente — casa pelo `laravel_service_id`, por isso correr duas vezes
 * actualiza em vez de duplicar.
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

  const r = await sincronizarPedidosDaApp();
  await logCronRun("app-requests", !r.erro, r.erro ?? resumo(r), r.criados + r.atualizados);
  return NextResponse.json(r, { status: r.erro ? 503 : 200 });
}
