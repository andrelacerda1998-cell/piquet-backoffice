/**
 * Leitura do corpo de um pedido de ticket — JSON ou formulário com fotos.
 *
 * Vive fora do route.ts porque o Next não deixa um ficheiro de rota exportar
 * mais do que os handlers, e isto tem de ser testável: é aqui que um engano
 * deixa cair em silêncio as fotos de um cliente. O ticket chega na mesma, sem
 * elas, e ninguém dá por isso até alguém perguntar "mas não mandaste a foto?".
 */
export async function lerPedido(
  req: Request,
): Promise<{ body: Record<string, unknown>; imagens: File[] }> {
  const tipo = req.headers.get("content-type") ?? "";

  // As versões da app já instaladas mandam JSON e vão continuar a mandar. Ler
  // o Content-Type em vez de assumir é o que impede uma actualização do
  // backoffice de partir quem nunca actualizar a app.
  if (!tipo.includes("multipart/form-data")) {
    return { body: (await req.json()) as Record<string, unknown>, imagens: [] };
  }

  const form = await req.formData();
  const body = Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, unknown>;

  return { body, imagens: form.getAll("images").filter((v): v is File => v instanceof File) };
}
