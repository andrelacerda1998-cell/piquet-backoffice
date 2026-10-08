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
  /** O que se inseriu, por tabela (para os testes verem o que ficou gravado). */
  inserts: Array<{ table: string; row: unknown }>;
} = { tables: {}, user: { id: "staff-1", email: "ana@piquet.pt" }, authError: false, inserts: [] };

function builder(result: Result, table = ""): any {
  const b: any = {};
  for (const m of ["select", "eq", "or", "ilike", "gte", "lte", "gt", "order", "range", "limit", "update", "upsert", "delete"]) {
    b[m] = () => b;
  }
  b.insert = (row: unknown) => { mockState.inserts.push({ table, row }); return b; };
  b.single = () => Promise.resolve(result);
  b.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
  return b;
}

/** Fábrica passada ao `vi.mock("@/lib/supabase/server")`. */
export function makeSupabaseMock() {
  return {
    SUPABASE_ENABLED: true,
    supabaseAdmin: () => ({
      from: (t: string) => builder(mockState.tables[t] ?? { data: [], error: null, count: 0 }, t),
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
  mockState.inserts = [];
}
