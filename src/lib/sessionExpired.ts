/**
 * O que fazer quando o servidor responde 401.
 *
 * O bug que isto corrige: a app guardava o utilizador em `localStorage` e o
 * guarda de rotas só olhava para aí. Quando a sessão do Supabase expirava, o
 * ecrã continuava a deixar entrar (porque o utilizador ainda lá estava), mas
 * todas as chamadas devolviam 401 com "Sessão expirada" — e como ninguém
 * limpava o estado, ficava-se preso nesse ciclo sem forma de voltar ao login.
 *
 * A limpeza tem de ser COMPLETA: token, sessão do Supabase e utilizador
 * guardado. Limpar só o token deixava o resto para trás e o ciclo mantinha-se.
 */

/** Evita várias limpezas em paralelo — vários pedidos falham 401 ao mesmo tempo. */
let aLimpar = false;

export interface SessionCleanup {
  clearToken: () => void;
  signOut: () => Promise<void>;
  clearUser: () => void;
  redirect: (to: string) => void;
}

export async function handleSessionExpired(c: SessionCleanup): Promise<boolean> {
  if (aLimpar) return false;
  aLimpar = true;
  try {
    c.clearToken();
    // O signOut pode falhar (rede, sessão já morta) — o logout local é o que
    // interessa e não pode depender dele.
    try { await c.signOut(); } catch { /* ignorado de propósito */ }
    c.clearUser();
    c.redirect("/login");
    return true;
  } finally {
    // Liberta passado um instante: se o utilizador voltar a entrar e a sessão
    // expirar outra vez, isto tem de funcionar de novo.
    setTimeout(() => { aLimpar = false; }, 3000);
  }
}

/** Só para os testes — repõe o guard entre casos. */
export function resetSessionExpiredGuard() {
  aLimpar = false;
}
