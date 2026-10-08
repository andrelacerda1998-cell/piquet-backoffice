import { redirect } from "next/navigation";

/**
 * Os pedidos personalizados vivem em Operações › Pedidos personalizados
 * (08/10/2026). Este endereço repetia o separador; continua a funcionar para
 * quem o tenha guardado (o sino e alertas antigos apontavam para aqui).
 */
export default function PedidosPersonalizadosAntigo() {
  redirect("/servicos?tab=personalizados");
}
