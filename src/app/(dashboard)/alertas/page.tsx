import { redirect } from "next/navigation";

/**
 * Os Alertas são um separador da Visão Geral (09/10/2026): é a lista completa
 * do que a fila "Precisa de ti" resume, e vive ao lado dela. Este endereço
 * continua a funcionar para quem o tenha guardado.
 */
export default function AlertasAntigo() {
  redirect("/?tab=alertas");
}
