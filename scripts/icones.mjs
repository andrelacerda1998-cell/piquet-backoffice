import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Gera os ícones da app.
 *
 * Existe como ficheiro, e não como script descartável, porque já foi
 * descartável uma vez: os ícones anteriores tinham um "P" em Helvetica sem
 * ninguém ter como saber disso nem como refazê-los.
 *
 * Correr com:  node scripts/icones.mjs
 *
 * ATENÇÃO: a letra vem de uma fonte do sistema (macOS). Noutra máquina sem
 * essa fonte, isto gera um "P" diferente em silêncio -- não falha. Os PNG são
 * o que conta e estão em git; se os regerares, confirma o resultado com os
 * olhos antes de fixar.
 */

const LETRA = "Futura";
const PESO = "bold";

const TINTA = "#1C1A17";
/** Altura da letra. 310 de 512 deixa-a dentro da zona segura do Android. */
const ALT = 310;
/** Quanto a fronteira desce em relação ao canto. Ver a nota no desenho. */
const DESVIO = 150;
/** Fresta escura entre os dois campos. */
const FOLGA = 13;

/**
 * A fronteira do contracampo: 45 graus, descida de DESVIO.
 *
 * Passa por BAIXO do bojo de propósito. Numa primeira tentativa ia a 39 graus
 * e atravessava-o, cortando-o em lascas; a 60px aquilo lia-se como um erro de
 * renderização e não como uma escolha. Assim só a haste muda de cor, e a
 * haste é um retângulo.
 */
const CAMPO = `M ${-DESVIO} 0 L 512 ${DESVIO + 512} L 512 512 L 0 512 Z`;

const GRAD = `
  <linearGradient id="ouro" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="#FFD98A"/><stop offset="0.42" stop-color="#FAB347"/><stop offset="1" stop-color="#D8902A"/>
  </linearGradient>
  <linearGradient id="fundo" x1="0" y1="0" x2="0.25" y2="1">
    <stop offset="0" stop-color="#2A2622"/><stop offset="0.55" stop-color="#1C1A17"/><stop offset="1" stop-color="#121110"/>
  </linearGradient>
  <linearGradient id="aro" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFF" stop-opacity="0.16"/><stop offset="0.5" stop-color="#FFF" stop-opacity="0.03"/><stop offset="1" stop-color="#FFF" stop-opacity="0"/>
  </linearGradient>`;

/**
 * O fundo: campo escuro em cima, campo de ouro em baixo.
 *
 * A fresta entre os dois não é decoração: sem ela os campos encostam e a
 * fronteira desaparece no troço em que é ouro contra ouro.
 */
const fundo = (raio) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>${GRAD}<clipPath id="quadro"><rect width="512" height="512" rx="${raio}"/></clipPath></defs>
  <rect width="512" height="512" rx="${raio}" fill="url(#fundo)"/>
  <g clip-path="url(#quadro)">
    <path d="${CAMPO}" fill="${TINTA}" transform="translate(${-FOLGA} ${-FOLGA})"/>
    <path d="${CAMPO}" fill="url(#ouro)"/>
  </g>
  <!-- Aro fino no topo: é o que dá a leitura de metal em vez de cor chapada. -->
  <rect x="1" y="1" width="510" height="510" rx="${Math.max(0, raio - 1)}" fill="none" stroke="url(#aro)" stroke-width="2"/>
</svg>`;

/*
  A cor da letra é sempre o INVERSO do fundo naquele ponto -- é isso o
  contracampo. Por isso basta desenhar o fundo com as cores trocadas e
  recortá-lo depois pela forma da letra.
*/
const inverso = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>${GRAD}</defs>
  <rect width="512" height="512" fill="url(#ouro)"/>
  <path d="${CAMPO}" fill="${TINTA}"/>
</svg>`;

/** O "P" como máscara, à altura certa e centrado nos 512. */
async function mascara() {
  const grande = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400">
    <text x="700" y="1100" text-anchor="middle" font-family="${LETRA}" font-weight="${PESO}" font-size="1000" fill="#fff">P</text>
  </svg>`;
  // trim() dá a caixa real do glifo; sem isso a letra fica descentrada pelo
  // espaço que a fonte reserva por baixo da linha de base.
  const apertada = await sharp(Buffer.from(grande)).png().trim().toBuffer();
  const redim = await sharp(apertada).resize({ height: ALT }).toBuffer();
  const { width, height } = await sharp(redim).metadata();
  return sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: redim, left: Math.round(256 - width / 2), top: Math.round(256 - height / 2) }])
    .png()
    .toBuffer();
}

const base = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icones");

const ficheiros = [
  { nome: "icone-192.png", size: 192, raio: 112 },
  { nome: "icone-512.png", size: 512, raio: 112 },
  /*
    Maskable: o Android recorta isto em círculo. Vai sem cantos arredondados
    -- senão sobra transparência nos cantos -- e conta com a letra estar
    dentro dos 80% centrais, que é a zona que o recorte garante.
  */
  { nome: "icone-maskable-512.png", size: 512, raio: 0 },
  /* O iOS arredonda sozinho e não aceita transparência. */
  { nome: "apple-touch-icon.png", size: 180, raio: 0 },
];

const m = await mascara();
const letra = await sharp(Buffer.from(inverso)).composite([{ input: m, blend: "dest-in" }]).png().toBuffer();

for (const f of ficheiros) {
  /*
    Em dois passos de propósito: o sharp aplica o resize ANTES do composite
    na mesma cadeia, e a base encolhia para 192 com a letra ainda a 512.
    Compõe-se tudo a 512 e só depois se reduz.
  */
  const completo = await sharp(Buffer.from(fundo(f.raio)))
    .composite([{ input: letra, blend: "over" }])
    .png()
    .toBuffer();

  await sharp(completo).resize(f.size, f.size).png().toFile(join(base, f.nome));
  console.log(`  ${f.nome}  ${f.size}x${f.size}`);
}
