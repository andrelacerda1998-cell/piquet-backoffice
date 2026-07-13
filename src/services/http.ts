/**
 * Núcleo HTTP partilhado.
 *
 * Uma única implementação de fetch (com timeout, headers, params e erros
 * normalizados) usada por AMBOS os clientes: `api.ts` (backoffice) e
 * `piquetClient.ts` (backend da app Flutter). Evita duplicar lógica de rede
 * e garante mensagens de erro/estados consistentes em toda a app.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export function buildUrl(base: string, endpoint: string, params?: QueryParams): string {
  const path = `${base}${endpoint}`;
  // Suporta base absoluta (http://host) e relativa (/api, same-origin).
  const isAbsolute = /^https?:\/\//i.test(path);
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const url = new URL(path, isAbsolute ? undefined : origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  // Relativo → devolve caminho+query (o fetch resolve same-origin).
  return isAbsolute ? url.toString() : url.pathname + url.search;
}

export interface HttpOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  params?: QueryParams;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  /** Timeout em ms (default 15s). */
  timeoutMs?: number;
  /** Chamado quando o servidor responde 401 (ex.: limpar token). */
  onUnauthorized?: () => void;
}

/** Pedido HTTP genérico. Lança `ApiError` normalizado em qualquer falha. */
export async function httpRequest<T>(base: string, endpoint: string, opts: HttpOptions = {}): Promise<T> {
  const { method = "GET", body, params, headers = {}, credentials, timeoutMs = 15000, onUnauthorized } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(buildUrl(base, endpoint, params), {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials,
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ApiError("Tempo de ligação esgotado.", 0);
    throw new ApiError("Falha de ligação ao servidor.", 0);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError("Sessão expirada. Inicie sessão novamente.", 401);
  }

  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const err = await res.json();
      message = err.message ?? err.error ?? message;
    } catch {
      /* resposta sem corpo JSON */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
