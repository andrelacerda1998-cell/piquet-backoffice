import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Gera os ícones da app a partir da arte da marca.
 *
 * Correr com:  node scripts/icones.mjs
 *
 * A fonte é `scripts/marca/piquet-gestao.webp`, o ficheiro fornecido pelo
 * André. Não se redesenha nem se recompõe nada: a arte é o ícone.
 *
 * A VERSÃO ANTERIOR RECORTAVA, esta não. Era um logótipo assente num preto
 * liso, e havia margem morta a tirar antes de escalar. Esta arte SANGRA pelos
 * bordos -- as fitas douradas fazem parte do desenho e tocam nos quatro lados
 * (confirmado: o trim não corta um único pixel). Recortá-la seria amputá-la.
 *
 * Também não se arredondam cantos. Numa arte que sangra, um canto transparente
 * seria um buraco no desenho; e quem mostra estes ícones já os mascara: o iOS
 * arredonda sozinho e o Android recorta em círculo. Quadrado é o que preserva
 * o que foi desenhado.
 */

const base = dirname(fileURLToPath(import.meta.url));
const MARCA = join(base, "marca", "piquet-gestao.webp");
const DESTINO = join(base, "..", "public", "icones");

const ficheiros = [
  { nome: "icone-192.png", size: 192 },
  { nome: "icone-512.png", size: 512 },
  /*
    Maskable: o Android recorta em círculo. Uma arte que sangra é o caso
    IDEAL para isto -- o que o círculo come são as fitas dos cantos, e a
    marca fica ao centro, muito dentro da zona segura (ocupa ~60% da largura,
    e o círculo garante 80%). É a mesma imagem, sem versão própria.
  */
  { nome: "icone-maskable-512.png", size: 512 },
  /* O iOS arredonda sozinho e não aceita transparência. */
  { nome: "apple-touch-icon.png", size: 180 },
];

for (const f of ficheiros) {
  const info = await sharp(MARCA)
    .resize(f.size, f.size, { fit: "cover" })
    .png({ quality: 92 })
    .toFile(join(DESTINO, f.nome));
  console.log(`  ${f.nome}  ${f.size}x${f.size}  ${Math.round(info.size / 1024)} KB`);
}
