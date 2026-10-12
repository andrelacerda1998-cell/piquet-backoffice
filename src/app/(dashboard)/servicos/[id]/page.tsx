import ServicosView from "../ServicosView";

/** A ficha de um pedido, com endereço próprio: /servicos/282. */
export default async function FichaDoPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServicosView abrirId={id} />;
}
