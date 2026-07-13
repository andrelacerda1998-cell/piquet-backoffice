/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Harness de mock do cliente Supabase para testar as Route Handlers sem BD.
 *
 * `mockState` é mutável: cada teste define os resultados por tabela (`setTable`)
 * e o utilizador autenticado. O builder devolvido é encadeável e "thenable"
 * (como o do supabase-js), resolvendo sempre no resultado da tabela.
 */

interface Result { data?: unknown; error?: unknown; count?: number }

export const mockState: {
  tables: Record<string, Result>;
  user: { id: string; email: string } | null;
  authError: boolean;
} = { tables: {}, user: { id: "staff-1", email: "ana@piquet.pt" }, authError: false };

function builder(result: Result): any {
  const b: any = {};
  for (const m of ["select", "eq", "or", "ilike", "gte", "lte", "gt", "order", "range", "limit", "insert", "update"]) {
    b[m] = () => b;
  }
  b.single = () => Promise.resolve(result);
  b.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
  return b;
}

/** Fábrica passada ao `vi.mock("@/lib/supabase/server")`. */
export function makeSupabaseMock() {
  return {
    SUPABASE_ENABLED: true,
    supabaseAdmin: () => ({
      from: (t: string) => builder(mockState.tables[t] ?? { data: [], error: null, count: 0 }),
      auth: {
        getUser: () =>
          Promise.resolve(
            mockState.authError
              ? { data: { user: null }, error: { message: "invalid" } }
              : { data: { user: mockState.user }, error: null }
          ),
      },
    }),
  };
}

export function setTable(name: string, result: Result) {
  mockState.tables[name] = result;
}

/** Repõe o estado base: staff autenticado válido. */
export function resetMock() {
  mockState.tables = { staff: { data: { role: "cto", email: "rodrigo@piquet.pt" } } };
  mockState.user = { id: "staff-1", email: "rodrigo@piquet.pt" };
  mockState.authError = false;
}
