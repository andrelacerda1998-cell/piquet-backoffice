import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Gera os ícones da app a partir do logótipo da marca.
 *
 * Existe como ficheiro, e não como script descartável, porque já foi
 * descartável uma vez: os ícones anteriores tinham um "P" em Helvetica em vez
 * do da Piquet, e ninguém tinha como saber disso nem como refazê-los.
 *
 * Correr com:  node scripts/icones.mjs
 */

/*
  O "P" verdadeiro, tirado do logótipo em vetor da app dos técnicos
  (app-vendor/assets/svgs/logo.tsx). Caixa do glifo: 108 x 153.
*/
const P =
  "M0 2.48633C81.5094 2.48633 81.5094 2.48633 96.7188 17.1426C104.609 25.6769 107.858 36.082 108.25 47.5488C107.518 59.0825 103.886 70.2985 95.8086 78.9004C77.2311 95.1908 56.0819 92.4863 32 92.4863C31.67 113.276 31.34 134.066 31 155.486C20.77 155.486 10.54 155.486 0 155.486C0 104.996 0 54.5063 0 2.48633ZM31 27.4863C31 40.6863 31 53.8863 31 67.4863C35.95 67.4038 40.9 67.3213 46 67.2363C48.3184 67.2126 48.3184 67.2126 50.6836 67.1885C59.305 66.9754 65.949 66.5373 72.375 60.1113C75.8827 54.445 76.7419 49.0379 76 42.4863C74.7821 37.9526 72.7284 34.3862 69 31.4863C62.8218 28.4534 57.6573 27.355 50.8242 27.3887C49.781 27.3912 48.7377 27.3937 47.6628 27.3962C45.695 27.4099 45.695 27.4099 43.6875 27.4238C37.4072 27.4548 37.4072 27.4548 31 27.4863Z";

const TINTA = "#1C1A17";

/** Altura da letra. 310 de 512 deixa-a dentro da zona segura do Android. */
const ALT = 310;
/** Quanto a fronteira desce em relação ao canto. Ver a nota no desenho. */
const DESVIO = 150;
/** Fresta escura entre os dois campos. */
const FOLGA = 13;

/**
 * Contracampo na diagonal: a letra troca de cor onde cruza a fronteira.
 *
 * A fronteira é a 45º e passa por BAIXO do bojo, de propósito. Numa versão
 * anterior ia a 39º e atravessava o bojo, cortando-o em lascas -- a 60px
 * aquilo lia-se como um erro de renderização e não como uma escolha. Assim,
 * o que muda de cor é só a haste, que é um retângulo.
 *
 * A fresta também não é decoração: sem ela, os dois campos encostam e a
 * fronteira desaparece no troço em que é ouro contra ouro.
 */
function desenho({ raio }) {
  const k = ALT / 153;
  const x = 256 - (108 * k) / 2;
  const y = 256 - ALT / 2;
  const letra = (fill, extra = "") =>
    `<g ${extra} transform="translate(${x} ${y}) scale(${k})"><path d="${P}" fill="${fill}" transform="translate(0 -2.48633)"/></g>`;

  // Fronteira a 45º, descida de DESVIO.
  const campo = `M ${-DESVIO} 0 L 512 ${DESVIO + 512} L 512 512 L 0 512 Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="ouro" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#FFD98A"/><stop offset="0.42" stop-color="#FAB347"/><stop offset="1" stop-color="#D8902A"/>
    </linearGradient>
    <linearGradient id="fundo" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#2A2622"/><stop offset="0.55" stop-color="#1C1A17"/><stop offset="1" stop-color="#121110"/>
    </linearGradient>
    <linearGradient id="aro" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF" stop-opacity="0.16"/><stop offset="0.5" stop-color="#FFF" stop-opacity="0.03"/><stop offset="1" stop-color="#FFF" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="quadro"><rect width="512" height="512" rx="${raio}"/></clipPath>
    <clipPath id="metade"><path d="${campo}"/></clipPath>
  </defs>
  <rect width="512" height="512" rx="${raio}" fill="url(#fundo)"/>
  <g clip-path="url(#quadro)">
    ${letra("url(#ouro)")}
    <path d="${campo}" fill="${TINTA}" transform="translate(${-FOLGA} ${-FOLGA})"/>
    <path d="${campo}" fill="url(#ouro)"/>
    <g clip-path="url(#metade)">${letra(TINTA)}</g>
  </g>
  <!-- Aro fino no topo: é o que dá a leitura de metal em vez de cor chapada. -->
  <rect x="1" y="1" width="510" height="510" rx="${Math.max(0, raio - 1)}" fill="none" stroke="url(#aro)" stroke-width="2"/>
</svg>`;
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

for (const f of ficheiros) {
  await sharp(Buffer.from(desenho({ raio: f.raio })))
    .resize(f.size, f.size)
    .png()
    .toFile(join(base, f.nome));
  console.log(`  ${f.nome}  ${f.size}x${f.size}`);
}
