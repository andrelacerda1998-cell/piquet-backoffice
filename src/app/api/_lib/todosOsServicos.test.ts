/**
 * A leitura do histórico inteiro de serviços: uma por minuto, partilhada,
 * com as páginas em paralelo e pela ordem certa.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

let paginas: Array<Array<{ id: number }>> = [];
let comMeta = true;
const pedidos: number[] = [];
vi.mock("@/lib/laravelAdmin", () => ({
  LARAVEL_ADMIN_ENABLED: true,
  laravelAdminRequest: vi.fn(async (caminho: string) => {
    const n = Number(new URL(`http://x${caminho}`).searchParams.get("page"));
    pedidos.push(n);
    // A página 1 demora mais: se a ordem dependesse de quem chega primeiro, falhava.
    await new Promise((r) => setTimeout(r, n === 2 ? 5 : 0));
    return { items: paginas[n - 1] ?? [], ...(comMeta ? { meta: { last_page: paginas.length } } : {}) };
  }),
}));

import { fetchAllLaravelServices, _esquecerServicos, LIMITE_DE_PAGINAS } from "./laravelServices";

const cheia = (desde: number) => Array.from({ length: 100 }, (_, i) => ({ id: desde + i }));

beforeEach(() => {
  _esquecerServicos();
  pedidos.length = 0;
  comMeta = true;
  paginas = [cheia(1), cheia(101), [{ id: 201 }]];
});
afterEach(() => vi.useRealTimers());

describe("fetchAllLaravelServices", () => {
  it("lê todas as páginas, pela ordem", async () => {
    const todos = await fetchAllLaravelServices();
    expect(todos.map((s) => Number(s.id))).toEqual([...Array.from({ length: 201 }, (_, i) => i + 1)]);
  });

  it("dois pedidos ao mesmo tempo fazem uma leitura só", async () => {
    await Promise.all([fetchAllLaravelServices(), fetchAllLaravelServices()]);
    expect(pedidos.sort()).toEqual([1, 2, 3]);
  });

  it("dentro de um minuto responde da cache; passado o minuto, volta a ler", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await fetchAllLaravelServices();
    await fetchAllLaravelServices();
    expect(pedidos).toHaveLength(3);
    vi.setSystemTime(Date.now() + 61_000);
    await fetchAllLaravelServices();
    expect(pedidos).toHaveLength(6);
  });

  it("`fresco` passa à frente da cache", async () => {
    await fetchAllLaravelServices();
    await fetchAllLaravelServices({ fresco: true });
    expect(pedidos).toHaveLength(6);
  });

  it("quem recebe a lista não estraga a dos outros", async () => {
    const a = await fetchAllLaravelServices();
    a.length = 0;
    expect(await fetchAllLaravelServices()).toHaveLength(201);
  });

  it("um backend sem `meta` continua a ser lido página a página", async () => {
    comMeta = false;
    expect(await fetchAllLaravelServices()).toHaveLength(201);
  });

  it("passando o limite, lê até ao limite e diz-o em vez de se calar", async () => {
    paginas = Array.from({ length: LIMITE_DE_PAGINAS + 2 }, () => [{ id: 1 }]);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const todos = await fetchAllLaravelServices();
    expect(todos).toHaveLength(LIMITE_DE_PAGINAS);
    expect(erro).toHaveBeenCalledWith(expect.stringContaining(`${LIMITE_DE_PAGINAS + 2} páginas`));
    erro.mockRestore();
  });
});
