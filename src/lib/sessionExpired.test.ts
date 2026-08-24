import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleSessionExpired, resetSessionExpiredGuard } from "./sessionExpired";

const fazerCleanup = () => ({
  clearToken: vi.fn(),
  signOut: vi.fn(async () => {}),
  clearUser: vi.fn(),
  redirect: vi.fn(),
});

beforeEach(() => resetSessionExpiredGuard());

describe("handleSessionExpired", () => {
  it("limpa TUDO e manda para o login", async () => {
    // Limpar só o token era o bug: o utilizador ficava no localStorage e o
    // guarda de rotas continuava a deixar entrar.
    const c = fazerCleanup();
    expect(await handleSessionExpired(c)).toBe(true);
    expect(c.clearToken).toHaveBeenCalledOnce();
    expect(c.signOut).toHaveBeenCalledOnce();
    expect(c.clearUser).toHaveBeenCalledOnce();
    expect(c.redirect).toHaveBeenCalledWith("/login");
  });

  it("com vários 401 ao mesmo tempo, só limpa uma vez", async () => {
    const c = fazerCleanup();
    const r = await Promise.all([handleSessionExpired(c), handleSessionExpired(c), handleSessionExpired(c)]);
    expect(r.filter(Boolean)).toHaveLength(1);
    expect(c.redirect).toHaveBeenCalledOnce();
  });

  it("se o signOut falhar, o logout local acontece na mesma", async () => {
    // Sem isto, uma falha de rede deixava o utilizador preso outra vez.
    const c = { ...fazerCleanup(), signOut: vi.fn(async () => { throw new Error("rede"); }) };
    expect(await handleSessionExpired(c)).toBe(true);
    expect(c.clearUser).toHaveBeenCalledOnce();
    expect(c.redirect).toHaveBeenCalledWith("/login");
  });

  it("volta a funcionar depois de o guard libertar", async () => {
    const c = fazerCleanup();
    await handleSessionExpired(c);
    resetSessionExpiredGuard();
    expect(await handleSessionExpired(c)).toBe(true);
    expect(c.redirect).toHaveBeenCalledTimes(2);
  });
});
