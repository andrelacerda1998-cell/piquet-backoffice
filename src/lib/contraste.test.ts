import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O tema tem de continuar legível.
 *
 * As cores do backoffice foram desenhadas primeiro para o tema escuro e, no
 * claro, várias ficavam abaixo do mínimo legível — o texto das etiquetas
 * âmbar dava 2,1:1, quase invisível num ecrã com brilho. Este teste fixa isso:
 * se alguém voltar a clarear um tom de texto, falha aqui em vez de falhar no
 * ecrã de quem o usa.
 *
 * Mínimo: 4,5:1 (WCAG AA para texto normal).
 */

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Lê "--nome: R G B" do bloco pedido (`:root` para o claro, `.dark` para o escuro). */
function token(bloco: ":root" | ".dark", nome: string): [number, number, number] {
  const inicio = css.indexOf(`${bloco} {`);
  const corpo = css.slice(inicio, css.indexOf("}", inicio));
  const m = corpo.match(new RegExp(`--${nome}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`));
  if (!m) throw new Error(`Token --${nome} não encontrado em ${bloco}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const luminancia = ([r, g, b]: [number, number, number]) => {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const contraste = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const AA = 4.5;

describe("tema claro — contraste do texto", () => {
  const fundo = () => token(":root", "surface-muted");
  const branco: [number, number, number] = [255, 255, 255];

  it.each([
    ["text-primary", "text-primary"],
    ["text-secondary", "text-secondary"],
    ["text-muted", "text-muted"],
  ])("%s é legível sobre o fundo da página", (_, nome) => {
    expect(contraste(token(":root", nome), fundo())).toBeGreaterThanOrEqual(AA);
  });

  it.each([
    ["success", "success", "success-light"],
    ["warning", "warning", "warning-light"],
    ["danger", "danger", "danger-light"],
    ["info", "info", "info-light"],
  ])("text-%s é legível sobre a sua etiqueta", (_, cor, etiqueta) => {
    expect(contraste(token(":root", cor), token(":root", etiqueta))).toBeGreaterThanOrEqual(AA);
  });

  it.each([["piquet-600"], ["piquet-700"]])("%s (links) é legível sobre branco", (nome) => {
    expect(contraste(token(":root", nome), branco)).toBeGreaterThanOrEqual(AA);
  });
});

describe("tema escuro — contraste do texto", () => {
  const fundo = () => token(".dark", "surface");

  it.each([["text-primary"], ["text-secondary"], ["text-muted"]])(
    "%s é legível sobre o fundo", (nome) => {
      expect(contraste(token(".dark", nome), fundo())).toBeGreaterThanOrEqual(AA);
    });

  it.each([["success"], ["warning"], ["info"], ["piquet-600"], ["piquet-700"]])(
    "text-%s é legível sobre o fundo", (nome) => {
      expect(contraste(token(".dark", nome), fundo())).toBeGreaterThanOrEqual(AA);
    });
});

describe("branco sobre vermelho", () => {
  // O `danger` é a única semântica usada como FUNDO com texto branco por cima
  // (botão de confirmação destrutiva, contador do sino). Clareá-lo para o texto
  // vermelho ficar melhor estragaria estes dois — o teste guarda o equilíbrio.
  it.each([[":root"], [".dark"]] as const)("continua legível em %s", (bloco) => {
    expect(contraste([255, 255, 255], token(bloco, "danger"))).toBeGreaterThanOrEqual(4);
  });
});
