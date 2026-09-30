/**
 * O lado do browser das notificações push.
 *
 * Separado da UI de propósito: a conversa com o service worker e com o
 * `PushManager` tem arestas (chaves em base64url, promessas que só resolvem
 * depois de o worker estar pronto) e não pertence dentro de um componente.
 */

export type EstadoPush =
  | "indisponivel"      // o browser não suporta (ou está num contexto sem HTTPS)
  | "precisa_instalar"  // iOS: só funciona com a página no ecrã inicial
  | "por_autorizar"
  | "recusado"
  | "ligado";

/** A chave pública VAPID vem em base64url e o browser quer bytes. */
function paraBytes(base64url: string): Uint8Array {
  const preenchido = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=");
  const normal = preenchido.replace(/-/g, "+").replace(/_/g, "/");
  const cru = atob(normal);
  return Uint8Array.from([...cru].map((c) => c.charCodeAt(0)));
}

export const suportaPush = (): boolean =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

/**
 * No iOS, o Web Push só existe se a página estiver instalada no ecrã inicial.
 * No browser normal a API nem aparece — e dizer "o teu browser não suporta"
 * seria mentira: suporta, falta é instalar.
 */
export const ehIOS = (): boolean =>
  typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

export const estaInstalada = (): boolean =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true);

export async function estadoAtual(): Promise<EstadoPush> {
  if (!suportaPush()) return ehIOS() && !estaInstalada() ? "precisa_instalar" : "indisponivel";
  if (Notification.permission === "denied") return "recusado";
  if (Notification.permission !== "granted") return "por_autorizar";

  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "ligado" : "por_autorizar";
}

/** Regista o service worker. Idempotente — pode chamar-se em cada arranque. */
export async function registarWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!suportaPush()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/**
 * Pede autorização, subscreve e guarda no servidor.
 *
 * Devolve o estado final em vez de atirar: quem chama está num botão, e um
 * erro aqui é "não deu", não uma avaria do ecrã.
 */
export async function ligarNotificacoes(chavePublica: string): Promise<EstadoPush> {
  if (!suportaPush()) return ehIOS() && !estaInstalada() ? "precisa_instalar" : "indisponivel";

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied" ? "recusado" : "por_autorizar";

  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registarWorker());
  if (!reg) return "indisponivel";
  // `ready` espera que o worker esteja mesmo ativo — subscrever antes disso
  // falha em silêncio no Safari.
  await navigator.serviceWorker.ready;

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      // Obrigatório: o browser recusa subscrições que não mostrem nada ao utilizador.
      userVisibleOnly: true,
      applicationServerKey: paraBytes(chavePublica) as BufferSource,
    }));

  const r = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await autorizacao()) },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!r.ok) throw new Error("O servidor não aceitou a subscrição.");

  return "ligado";
}

export async function desligarNotificacoes(): Promise<EstadoPush> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return "por_autorizar";

  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...(await autorizacao()) },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();

  return "por_autorizar";
}

/**
 * O token de staff, pela MESMA via que o resto do cliente usa.
 *
 * Estas chamadas não passam pelo `apiPost` porque não devolvem dados do
 * negócio e não devem ser zeradas em modo demonstração — mas a autenticação
 * tem de ser a mesma. O token é o do Supabase, renovado a cada pedido por
 * `currentToken()`; lê-lo do localStorage à mão dava 401 em silêncio assim
 * que a sessão fosse renovada.
 */
async function autorizacao(): Promise<Record<string, string>> {
  const { currentToken } = await import("@/services/api");
  const token = await currentToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
