import { supabaseAdmin } from "@/lib/supabase/server";

/** Quantas imagens um ticket aceita, e o peso máximo de cada uma. */
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_BYTES = 8 * 1024 * 1024;

/**
 * Formatos que um browser mostra numa <img>.
 *
 * O HEIC do iPhone NÃO está cá, de propósito: nenhum browser o desenha, e uma
 * foto aceite em HEIC chegava ao backoffice como um ícone partido — a pior das
 * falhas, porque parece que funcionou. A app converte para JPEG antes de
 * enviar; esta lista é a rede por baixo, para versões antigas e para o dia em
 * que alguém mudar o lado do cliente sem se lembrar deste.
 */
const TIPOS_ACEITES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Sobe as imagens que vieram com o ticket e devolve os CAMINHOS no bucket.
 *
 * Caminhos e não URLs: o bucket é privado e o backoffice assina um URL de curta
 * duração quando abre o ticket. Guardar um URL na base de dados era guardar
 * uma credencial permanente para uma foto de dentro de casa de alguém.
 *
 * Corre com a service role, do lado do servidor: é por isso que o telemóvel
 * nunca precisa de uma credencial de escrita no Storage. O que falhar é
 * ignorado em silêncio — uma foto que não sobe não pode impedir alguém de
 * pedir ajuda, e o texto do ticket chega na mesma.
 */
export async function subirImagens(files: File[]): Promise<string[]> {
  const paths: string[] = [];
  let total = 0;

  for (const file of files.slice(0, MAX_IMAGES)) {
    if (!TIPOS_ACEITES.includes(file.type)) continue;
    if (file.size > MAX_IMAGE_BYTES) continue;
    total += file.size;
    if (total > MAX_IMAGES_BYTES) break;

    // Nome gerado por nós: o que vem do telemóvel não é de confiança e podia
    // trazer caminhos ("../") ou extensões enganosas.
    const ext = (file.type.split("/")[1] || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const path = `tickets/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabaseAdmin()
      .storage.from("ticket-images")
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (error) continue;

    paths.push(path);
  }

  return paths;
}
