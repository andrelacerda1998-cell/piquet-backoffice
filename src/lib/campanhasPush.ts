/**
 * Criar campanhas de push no backoffice (15/10/2026, pedido do André).
 *
 * Criar ficava só no Filament, de propósito: uma campanha ativa é uma push a
 * milhares de pessoas. Passa a dar aqui, mas em três passos:
 *
 *  1. guarda-se DESLIGADA, como rascunho (o Laravel recusa outra coisa);
 *  2. vê-se a quantas pessoas chega, com a mesma regra do envio
 *     (App\Services\Campanhas\PublicoDaCampanha);
 *  3. liga-se à parte, com o número outra vez à frente e um motivo, que fica
 *     no histórico da equipa em nome de quem ligou.
 *
 * Os campos são os do formulário do Filament (NotificationCampaignResource).
 */

export type Alvo = "customer" | "vendor" | "both";
export type Frequencia = "once" | "daily" | "weekly" | "custom";
export type UnidadeDoIntervalo = "minutes" | "hours" | "days";

export interface DadosDaCampanha {
  name: string;
  title: { "pt-pt": string; en: string };
  body: { "pt-pt": string; en: string };
  english_reviewed: boolean;
  target_type: Alvo;
  /** Só numa campanha só de técnicos. */
  user_status: "online" | "offline" | null;
  vendor_eligibility: "ready" | "incomplete" | null;
  vendor_missing_schedule_address: boolean;
  customer_never_requested: boolean;
  inactive_days: number | null;
  /** O ecrã que a notificação abre, só nos clientes. */
  open_type: "OperationArea" | "ServicesType" | null;
  open_id: number | null;
  frequency_type: Frequencia;
  frequency_value: number | null;
  frequency_unit: UnidadeDoIntervalo | null;
  /** ISO 8601, ou null. */
  starts_at: string | null;
  ends_at: string | null;
}

/** O que o Laravel aceita no público (a contagem não precisa do texto). */
export type PublicoDaCampanha = Pick<DadosDaCampanha,
  "target_type" | "user_status" | "vendor_eligibility" | "vendor_missing_schedule_address" | "customer_never_requested" | "inactive_days">;

export const CAMPANHA_VAZIA: DadosDaCampanha = {
  name: "",
  title: { "pt-pt": "", en: "" },
  body: { "pt-pt": "", en: "" },
  english_reviewed: false,
  target_type: "customer",
  user_status: null,
  vendor_eligibility: null,
  vendor_missing_schedule_address: false,
  customer_never_requested: false,
  inactive_days: null,
  open_type: null,
  open_id: null,
  frequency_type: "once",
  frequency_value: null,
  frequency_unit: null,
  starts_at: null,
  ends_at: null,
};

/** No Filament dava para mandar push a toda a gente de minuto a minuto. */
export const INTERVALO_MINIMO_EM_MINUTOS = 60;

export const LIMITES = { titulo: 255, texto: 1000 } as const;

const MINUTOS: Record<UnidadeDoIntervalo, number> = { minutes: 1, hours: 60, days: 1440 };

/** O que falta ou está mal, para o botão dizer porque não grava. Vazio = pode gravar. */
export function problemasDaCampanha(d: DadosDaCampanha): string[] {
  const p: string[] = [];
  if (!d.name.trim()) p.push("Falta o nome da campanha.");
  if (!d.title["pt-pt"].trim()) p.push("Falta o título em português.");
  if (!d.body["pt-pt"].trim()) p.push("Falta o texto em português.");
  if (d.title["pt-pt"].length > LIMITES.titulo || d.title.en.length > LIMITES.titulo) p.push(`O título vai até ${LIMITES.titulo} caracteres.`);
  if (d.body["pt-pt"].length > LIMITES.texto || d.body.en.length > LIMITES.texto) p.push(`O texto vai até ${LIMITES.texto} caracteres.`);
  if (d.frequency_type === "custom") {
    const minutos = (d.frequency_value ?? 0) * MINUTOS[d.frequency_unit ?? "minutes"];
    if (minutos < INTERVALO_MINIMO_EM_MINUTOS) p.push("O intervalo mínimo é de uma hora.");
  }
  if (d.open_type && !d.open_id) p.push("Escolhe o que a notificação abre, ou nada.");
  if (d.starts_at && d.ends_at && Date.parse(d.ends_at) <= Date.parse(d.starts_at)) p.push("O fim tem de ser depois do início.");
  return p;
}

/** Há inglês escrito? Então tem de ser revisto antes de a campanha sair. */
export function temIngles(d: Pick<DadosDaCampanha, "title" | "body">): boolean {
  return d.title.en.trim() !== "" || d.body.en.trim() !== "";
}

/** Só o público, para a contagem. */
export function publicoDe(d: DadosDaCampanha): PublicoDaCampanha {
  return {
    target_type: d.target_type,
    user_status: d.user_status,
    vendor_eligibility: d.vendor_eligibility,
    vendor_missing_schedule_address: d.vendor_missing_schedule_address,
    customer_never_requested: d.customer_never_requested,
    inactive_days: d.inactive_days,
  };
}

/** "Uma vez", "Todos os dias", "De 3 em 3 horas"… */
export function resumoDaFrequencia(f: { frequency_type: string | null; frequency_value?: number | null; frequency_unit?: string | null }): string {
  switch (f.frequency_type) {
    case "once": return "Uma vez";
    case "daily": return "Todos os dias";
    case "weekly": return "Todas as semanas";
    case "custom": {
      const n = f.frequency_value ?? 0;
      const unidade = f.frequency_unit === "days" ? (n === 1 ? "dia" : "dias")
        : f.frequency_unit === "hours" ? (n === 1 ? "hora" : "horas")
        : (n === 1 ? "minuto" : "minutos");
      return `De ${n} em ${n} ${unidade}`;
    }
    default: return "—";
  }
}

/** As chaves que seguem para o Laravel: um corpo com mais nada não passa daqui. */
export function soOsCampos(b: Record<string, unknown>): Record<string, unknown> {
  const chaves: Array<keyof DadosDaCampanha> = [
    "name", "title", "body", "english_reviewed", "target_type", "user_status", "vendor_eligibility",
    "vendor_missing_schedule_address", "customer_never_requested", "inactive_days", "open_type", "open_id",
    "frequency_type", "frequency_value", "frequency_unit", "starts_at", "ends_at",
  ];
  return Object.fromEntries(chaves.filter((k) => k in b).map((k) => [k, b[k]]));
}
