import { describe, it, expect } from "vitest";
import { versionsToTry, shouldTryNextVersion, GOOGLE_ADS_VERSIONS } from "./googleAdsVersion";

describe("versionsToTry", () => {
  it("sem preferência, tenta da mais recente para a mais antiga", () => {
    expect(versionsToTry()).toEqual([...GOOGLE_ADS_VERSIONS]);
    expect(versionsToTry(null)).toEqual([...GOOGLE_ADS_VERSIONS]);
    expect(versionsToTry("  ")).toEqual([...GOOGLE_ADS_VERSIONS]);
  });

  it("a versão preferida vai à frente, sem ficar repetida", () => {
    const r = versionsToTry("v24");
    expect(r[0]).toBe("v24");
    expect(r.filter((v) => v === "v24")).toHaveLength(1);
    expect(r).toHaveLength(GOOGLE_ADS_VERSIONS.length);
  });

  it("aceita uma versão que o código ainda não conhece", () => {
    const r = versionsToTry("v27");
    expect(r[0]).toBe("v27");
    expect(r).toHaveLength(GOOGLE_ADS_VERSIONS.length + 1);
  });

  it("não inclui versões já reformadas (v21 morreu em ago/2026)", () => {
    expect(GOOGLE_ADS_VERSIONS).not.toContain("v21");
    expect(GOOGLE_ADS_VERSIONS).not.toContain("v18");
  });
});

describe("shouldTryNextVersion", () => {
  it("só 404 indica versão reformada", () => {
    expect(shouldTryNextVersion(404)).toBe(true);
  });

  it("erros de credenciais não devem fazer rodar versões", () => {
    // Tentar outra versão com um token inválido só multiplica o mesmo erro
    // e esconde a causa real.
    for (const s of [401, 403, 400, 429, 500, 503]) {
      expect(shouldTryNextVersion(s)).toBe(false);
    }
  });
});
