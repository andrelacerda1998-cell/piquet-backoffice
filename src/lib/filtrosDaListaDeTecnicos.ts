import { atValidationState } from "./vendorDocs";

/**
 * Os filtros da lista de técnicos que se calculam aqui, sobre a lista toda (o
 * servidor só dá 100 de cada vez). "Todos" e "Suspensos" vêm do servidor.
 *
 *  - `at_validado`: a AT validada (a flag e a data -- ver atValidationState);
 *  - `so_falta_at`: já podem aceitar serviços e só a AT está por validar. São os
 *    que trabalham sem ela, até ao terceiro serviço feito;
 *  - `falta_documentos`: já entregaram algum documento, mas os obrigatórios
 *    ainda não estão todos aprovados e dentro da validade. Quem nunca entregou
 *    nada fica de fora: ainda não começou.
 */
export type FiltroCalculado = "at_validado" | "so_falta_at" | "falta_documentos";

export interface TecnicoFiltravel {
  id: number;
  can_accept_service: boolean;
  all_documents_verified?: boolean;
  at_valid: boolean;
  at_validated_at: string | null;
}

export function filtrarTecnicos<T extends TecnicoFiltravel>(
  lista: T[],
  filtro: FiltroCalculado,
  entregaramAlgumDocumento: ReadonlySet<number>,
): T[] {
  switch (filtro) {
    case "at_validado":
      return lista.filter((v) => atValidationState(v) === "validado");
    case "so_falta_at":
      return lista.filter((v) => v.can_accept_service && atValidationState(v) !== "validado");
    case "falta_documentos":
      // `=== false` e não `!`: sem o campo (backend antigo) não se sabe.
      return lista.filter((v) => entregaramAlgumDocumento.has(v.id) && v.all_documents_verified === false);
  }
}
