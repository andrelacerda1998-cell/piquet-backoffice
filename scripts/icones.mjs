import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Gera os ícones da app a partir do logótipo "PIQUET GESTÃO".
 *
 * Correr com:  node scripts/icones.mjs
 *
 * A fonte é `scripts/marca/piquet-gestao.png`, o ficheiro que o André
 * forneceu. NÃO se redesenha nada: recorta-se o dourado, escala-se e
 * assenta-se no quadrado. Versões anteriores deste script desenhavam a letra
 * (primeiro em Helvetica, depois com o glifo do logótipo, depois em Bodoni) e
 * eram sempre uma aproximação do logótipo verdadeiro.
 *
 * O DESAFIO: o desenho é uma faixa de 2,92:1 e o ícone é um quadrado. Enche-se
 * a largura tanto quanto cada formato permite; a altura é o que sobrar. Um
 * logótipo horizontal num ícone quadrado tem sempre este preço.
 */

const base = dirname(fileURLToPath(import.meta.url));
const MARCA = join(base, "marca", "piquet-gestao.png");
const DESTINO = join(base, "..", "public", "icones");

/** O preto do ficheiro original. */
const FUNDO = "#000000";

const ficheiros = [
  /*
    `largura` é a fatia do quadrado que o desenho ocupa.

    O maskable leva menos porque o Android recorta em CÍRCULO: uma faixa de
    2,92:1 inscrita na zona segura (80% do lado) não pode passar dos ~76% de
    largura, senão os extremos do "P" e do "T" saem pela curva fora.
  */
  { nome: "icone-192.png", size: 192, raio: 112, largura: 0.88 },
  { nome: "icone-512.png", size: 512, raio: 112, largura: 0.88 },
  { nome: "icone-maskable-512.png", size: 512, raio: 0, largura: 0.72 },
  /* O iOS arredonda sozinho e não aceita transparência. */
  { nome: "apple-touch-icon.png", size: 180, raio: 0, largura: 0.88 },
];

/*
  `trim` encontra a caixa real do dourado dentro do quadrado preto. Sem isto,
  escalar a imagem inteira punha o desenho a ocupar 68% de 88% -- ou seja,
  60% do ícone -- e as letras ficavam ainda mais pequenas do que é preciso.
*/
const recortado = await sharp(MARCA).trim({ threshold: 12 }).png().toBuffer();
const { width: lc, height: hc } = await sharp(recortado).metadata();
console.log(`  marca recortada: ${lc}x${hc} (${(lc / hc).toFixed(2)}:1)`);

for (const f of ficheiros) {
  const larguraDesenho = Math.round(512 * f.largura);
  const desenho = await sharp(recortado).resize({ width: larguraDesenho }).toBuffer();
  const { height: hd } = await sharp(desenho).metadata();

  const fundo = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
       <rect width="512" height="512" rx="${f.raio}" fill="${FUNDO}"/>
     </svg>`,
  );

  // Compõe-se sempre a 512 e só depois se reduz: na mesma cadeia o sharp
  // aplica o resize ANTES do composite, e a base encolhia com o desenho
  // ainda em tamanho grande.
  const completo = await sharp(fundo)
    .composite([{ input: desenho, left: Math.round((512 - larguraDesenho) / 2), top: Math.round((512 - hd) / 2) }])
    .png()
    .toBuffer();

  await sharp(completo).resize(f.size, f.size).png().toFile(join(DESTINO, f.nome));
  console.log(`  ${f.nome}  ${f.size}x${f.size}  (desenho a ${Math.round(f.largura * 100)}% da largura)`);
}
