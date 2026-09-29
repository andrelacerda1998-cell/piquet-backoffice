/**
 * O funil real de quem se inscreveu para trabalhar na Piquet.
 *
 * Substitui o ecrã de Recrutamento, que mostrava candidatos, entrevistas e
 * tarefas inventados — não havia (nem há) sistema de recrutamento nenhum. O
 * recrutamento a sério da Piquet são as centenas de técnicos que criaram
 * conta na app e ficaram a meio: falta-lhes confirmar o contacto, aprovar
 * documentos, preencher o IBAN ou a morada fiscal. Enquanto isso não estiver
 * feito não podem receber trabalho, e ninguém lhes disse.
 *
 * A regra de o que falta NÃO vive aqui: vem do Laravel em `account_blocker`,
 * a mesma que a app do técnico lê no `GET /me`. Aqui só se agrupa e conta.
 */

export const ETAPAS = [
  "contact_unverified",
  "documents_pending",
  "iban_missing",
  "fiscal_address_missing",
] as const;

export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_LABEL: Record<Etapa, string> = {
  contact_unverified: "Contacto por confirmar",
  documents_pending: "Documentos por aprovar",
  iban_missing: "IBAN em falta",
  fiscal_address_missing: "Morada fiscal em falta",
};

/** O que a Piquet pode fazer para destravar cada etapa. */
export const ETAPA_ACAO: Record<Etapa, string> = {
  contact_unverified: "Só o técnico pode confirmar — vale a pena ligar-lhe.",
  documents_pending: "Depende de nós: rever os documentos em Técnicos › Aprovações.",
  iban_missing: "Só o técnico pode preencher, na app.",
  fiscal_address_missing: "Só o técnico pode preencher, na app.",
};

/** `true` quando é a Piquet que está a atrasar, não o técnico. */
export const ESPERA_POR_NOS: Record<Etapa, boolean> = {
  contact_unverified: false,
  documents_pending: true,
  iban_missing: false,
  fiscal_address_missing: false,
};

export interface TecnicoNoFunil {
  id: number;
  nome: string;
  telefone: string | null;
  /** `null` = está tudo pronto. */
  etapa: Etapa | null;
  criadoEm: string | null;
  /** Dias desde que criou a conta. `null` se a data não presta. */
  diasParado: number | null;
  categorias: string[];
}

export interface Funil {
  total: number;
  prontos: number;
  /** Contagem por etapa, sempre com as quatro chaves — zero é uma resposta. */
  porEtapa: Record<Etapa, number>;
  /** Quantos estão bloqueados por algo que depende da Piquet. */
  aEsperaDeNos: number;
  /** Os mais antigos por resolver, do mais parado para o menos. */
  parados: TecnicoNoFunil[];
}

const DIA_MS = 86_400_000;

export function diasDesde(iso: string | null | undefined, hoje: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const inicio = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const agora = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const dias = Math.floor((agora - inicio) / DIA_MS);
  return dias < 0 ? 0 : dias;
}

/** Só os quatro códigos conhecidos contam como etapa; o resto é "pronto". */
export function etapaDe(codigo: string | null | undefined): Etapa | null {
  return ETAPAS.includes(codigo as Etapa) ? (codigo as Etapa) : null;
}

interface VendorCru {
  id: number;
  name?: string | null;
  phone_number?: string | null;
  account_blocker?: string | null;
  created_at?: string | null;
  operation_areas?: string[] | null;
  suspended_at?: string | null;
}

/**
 * @param limiteParados quantos mostrar na lista dos mais antigos.
 */
export function construirFunil(
  vendors: VendorCru[],
  hoje: Date = new Date(),
  limiteParados = 25,
): Funil {
  const porEtapa: Record<Etapa, number> = {
    contact_unverified: 0, documents_pending: 0, iban_missing: 0, fiscal_address_missing: 0,
  };
  const parados: TecnicoNoFunil[] = [];
  let prontos = 0;
  let total = 0;

  for (const v of vendors) {
    // Suspensos não estão a meio de nada — saíram. Contá-los no funil dizia
    // que há trabalho a fazer com eles, e não há.
    if (v.suspended_at) continue;
    total++;

    const etapa = etapaDe(v.account_blocker);
    if (!etapa) { prontos++; continue; }

    porEtapa[etapa]++;
    parados.push({
      id: v.id,
      nome: v.name ?? `Técnico #${v.id}`,
      telefone: v.phone_number ?? null,
      etapa,
      criadoEm: v.created_at ?? null,
      diasParado: diasDesde(v.created_at, hoje),
      categorias: Array.isArray(v.operation_areas) ? v.operation_areas : [],
    });
  }

  // Do mais antigo para o mais recente: quem espera há mais tempo aparece
  // primeiro. Sem data vai para o fim, em vez de fingir que é de hoje.
  parados.sort((a, b) => (b.diasParado ?? -1) - (a.diasParado ?? -1));

  const aEsperaDeNos = ETAPAS.filter((e) => ESPERA_POR_NOS[e]).reduce((s, e) => s + porEtapa[e], 0);

  return { total, prontos, porEtapa, aEsperaDeNos, parados: parados.slice(0, limiteParados) };
}
