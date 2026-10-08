import { redirect } from "next/navigation";

/**
 * Os relatórios vivem no separador «Relatórios» da Visão Geral (08/10/2026). Este endereço repetia o separador e continua a funcionar
 * para quem o tenha guardado.
 */
export default function RelatoriosAntigo() {
  redirect("/?tab=relatorios");
}
