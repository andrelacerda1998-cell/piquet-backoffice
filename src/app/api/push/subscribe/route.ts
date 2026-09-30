import { apiOk, apiErr, withStaff } from "../../_lib/handler";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PUSH_CONFIGURADO } from "@/lib/push";

/**
 * Registar (e cancelar) o dispositivo para notificações push.
 *
 * Uma linha por DISPOSITIVO, não por pessoa: o telemóvel e o portátil têm
 * endpoints diferentes e ambos devem tocar. A chave é o endpoint, que o
 * browser garante único.
 */

interface Subscricao {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export const POST = withStaff(async (req, { staff }) => {
  if (!PUSH_CONFIGURADO) {
    return apiErr("As notificações precisam das chaves VAPID na Vercel.", 503);
  }

  const sub = (await req.json().catch(() => null)) as Subscricao | null;
  const endpoint = sub?.endpoint?.trim();
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return apiErr("Subscrição incompleta.", 400);
  }

  const { error } = await supabaseAdmin().from("push_subscriptions").upsert(
    {
      endpoint,
      staff_id: staff.userId,
      staff_email: staff.email,
      p256dh,
      auth,
      // Serve para distinguir dispositivos quando houver mais do que um.
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);

  return apiOk({ registado: true });
});

/** Deixar de receber neste dispositivo. */
export const DELETE = withStaff(async (req) => {
  const { endpoint } = ((await req.json().catch(() => ({}))) ?? {}) as { endpoint?: string };
  if (!endpoint) return apiErr("Falta o endpoint.", 400);

  const { error } = await supabaseAdmin().from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(error.message);

  return apiOk({ removido: true });
});
