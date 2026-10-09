import ClientesView from "../ClientesView";

/** A ficha de um cliente, com endereço próprio: /clientes/412. */
export default async function FichaDoClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientesView abrirId={id} />;
}
