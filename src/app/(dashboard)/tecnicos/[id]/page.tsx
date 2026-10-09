import TecnicosView from "../TecnicosView";

/** A ficha de um técnico, com endereço próprio: /tecnicos/94. */
export default async function FichaDoTecnicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TecnicosView abrirId={id} />;
}
