import { redirect } from "next/navigation";

/**
 * Impostos e RH vivem no separador com o mesmo nome do Financeiro (08/10/2026). Este endereço repetia o separador e continua a funcionar
 * para quem o tenha guardado.
 */
export default function ImpostosRhAntigo() {
  redirect("/financeiro?tab=impostos");
}
