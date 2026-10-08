import { redirect } from "next/navigation";

/**
 * Os objetivos vivem no separador «Objetivos do ano» da Visão Geral (08/10/2026). Este endereço repetia o separador e continua a funcionar
 * para quem o tenha guardado.
 */
export default function ObjetivosAntigo() {
  redirect("/?tab=objetivos");
}
