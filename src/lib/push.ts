import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Notificações push para quem gere a Piquet.
 *
 * O backoffice não tinha como tocar no ombro de ninguém: só se sabia de um
 * pedido urgente ou de um ticket se alguém estivesse a olhar para o ecrã. A
 * Estela Rodrigues esperou dez dias por uma resposta — não por falta de ecrã,
 * por falta de aviso.
 *
 * Isto é Web Push, o mesmo mecanismo de uma app nativa, sem app nativa. Exige
 * que a página esteja instalada no ecrã inicial (no iOS é obrigatório) e duas
 * chaves VAPID, que provam ao serviço de push que quem envia é mesmo este
 * servidor.
 */

const PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVADA = process.env.VAPID_PRIVATE_KEY ?? "";
/** Exigido pelo protocolo: por onde contactar quem envia, se houver problema. */
const CONTACTO = process.env.VAPID_SUBJECT ?? "mailto:geral@piquetapp.com";

export const PUSH_CONFIGURADO = PUBLICA.length > 0 && PRIVADA.length > 0;

if (PUSH_CONFIGURADO) {
  webpush.setVapidDetails(CONTACTO, PUBLICA, PRIVADA);
}

export interface Aviso {
  titulo: string;
  corpo: string;
  /** Para onde vai quem tocar na notificação. */
  url?: string;
  /**
   * Junta avisos do mesmo assunto num só.
   *
   * Sem isto, cinco tickets novos são cinco vibrações seguidas — a maneira
   * mais rápida de alguém desligar as notificações e nunca mais as ligar.
   */
  tag?: string;
}

interface LinhaSubscricao {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface ResultadoEnvio {
  enviados: number;
  /** Endpoints que já não existem e foram apagados. */
  removidos: number;
  /** Falhas que não são "o dispositivo desapareceu". */
  erros: string[];
}

/**
 * Envia a todos os dispositivos de staff registados.
 *
 * @param apenasStaffId envia só aos dispositivos daquela pessoa.
 */
export async function avisar(aviso: Aviso, apenasStaffId?: string): Promise<ResultadoEnvio> {
  if (!PUSH_CONFIGURADO) {
    return { enviados: 0, removidos: 0, erros: ["Faltam as chaves VAPID."] };
  }

  const q = supabaseAdmin().from("push_subscriptions").select("endpoint, p256dh, auth");
  const { data, error } = apenasStaffId ? await q.eq("staff_id", apenasStaffId) : await q;
  if (error) return { enviados: 0, removidos: 0, erros: [error.message] };

  const subs = (data ?? []) as LinhaSubscricao[];
  if (subs.length === 0) return { enviados: 0, removidos: 0, erros: [] };

  const carga = JSON.stringify({
    titulo: aviso.titulo,
    corpo: aviso.corpo,
    url: aviso.url ?? "/",
    tag: aviso.tag,
  });

  let enviados = 0;
  const mortos: string[] = [];
  const erros: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          carga,
          { TTL: 60 * 60 * 6 },
        );
        enviados++;
      } catch (e) {
        const estado = (e as { statusCode?: number })?.statusCode;
        /*
          404/410 = a subscrição morreu (app desinstalada, permissão
          revogada, browser limpo). O serviço de push diz explicitamente
          para parar de enviar — e se não se apagar, fica a tentar para
          sempre e os números de "enviados" passam a incluir ninguém.
          É a mesma lição dos tokens Expo do Laravel.
        */
        if (estado === 404 || estado === 410) {
          mortos.push(s.endpoint);
        } else {
          erros.push(`${estado ?? "?"}: ${(e as Error).message}`);
        }
      }
    }),
  );

  if (mortos.length > 0) {
    await supabaseAdmin().from("push_subscriptions").delete().in("endpoint", mortos);
  }
  if (enviados > 0) {
    await supabaseAdmin()
      .from("push_subscriptions")
      .update({ last_ok_at: new Date().toISOString() })
      .in("endpoint", subs.filter((s) => !mortos.includes(s.endpoint)).map((s) => s.endpoint));
  }

  return { enviados, removidos: mortos.length, erros };
}
