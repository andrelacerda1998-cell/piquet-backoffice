import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * Os alertas levam a `/pagina?tab=x`. Se o `x` não existir na página, o clique
 * abre o separador por omissão e parece que não fez nada — foi o que aconteceu
 * com "kyc" (o id real é "aprovacoes") e "faturas" (é "custos").
 *
 * Este teste lê os destinos reais do ecrã de Alertas e confirma que cada um
 * existe mesmo, em vez de confiar na memória de quem escreveu.
 */
const PAGINA = "src/app/(dashboard)/alertas/page.tsx";

function destinosDoEcra(): Array<{ href: string }> {
  const src = readFileSync(PAGINA, "utf8");
  const bloco = src.slice(src.indexOf("function destino("), src.indexOf("const GRUPOS"));
  return [...bloco.matchAll(/href: ["`]([^"`$]+)/g)].map((m) => ({ href: m[1] }));
}

const FICHEIRO: Record<string, string> = {
  "/produto": "src/app/(dashboard)/produto/page.tsx",
  "/tecnicos": "src/app/(dashboard)/tecnicos/page.tsx",
  "/financeiro": "src/app/(dashboard)/financeiro/page.tsx",
  "/leads": "src/app/(dashboard)/leads/page.tsx",
  "/marketing": "src/app/(dashboard)/marketing/page.tsx",
  "/suporte": "src/app/(dashboard)/suporte/page.tsx",
};

describe("destinos dos alertas", () => {
  const destinos = destinosDoEcra();

  it("o ecrã tem destinos definidos (o teste não passa por não encontrar nada)", () => {
    expect(destinos.length).toBeGreaterThanOrEqual(6);
  });

  it("cada separador apontado existe mesmo na página de destino", () => {
    for (const { href } of destinos) {
      const [caminho, query] = href.split("?");
      const tab = new URLSearchParams(query ?? "").get("tab");
      if (!tab) continue;
      const ficheiro = FICHEIRO[caminho];
      expect(ficheiro, `sem ficheiro conhecido para ${caminho}`).toBeTruthy();
      const src = readFileSync(ficheiro, "utf8");
      expect(src.includes(`id: "${tab}"`), `${href} → a página não tem o separador "${tab}"`).toBe(true);
    }
  });

  it("páginas com ?tab= sabem lê-lo do URL", () => {
    for (const { href } of destinos) {
      const [caminho, query] = href.split("?");
      if (!new URLSearchParams(query ?? "").get("tab")) continue;
      const src = readFileSync(FICHEIRO[caminho], "utf8");
      expect(src.includes("useTabParam"), `${caminho} não lê ?tab= — o link abriria no separador errado`).toBe(true);
    }
  });
});
