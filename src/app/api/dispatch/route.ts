import { supabaseAdmin } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/missingColumn";
import { extrairDadosLead } from "@/lib/leadReply";
import { categoryName, categoryFromMessage } from "@/lib/categories";
import { apiOk, withStaff } from "../_lib/handler";

/**
 * GET /api/dispatch — a fila de quem está à espera de técnico.
 *
 * A fila são LEADS, não serviços. Um serviço só existe depois de haver técnico
 * e preço; quem está à espera está antes disso. O ecrã anterior mostrava
 * serviços a fingir de fila e por isso nunca podia mostrar o problema real --
 * um pedido de ontem sem ninguém contactado.
 *
 * Sai daqui ordenado pelo que dói: primeiro quem já tem técnicos a aceitar e
 * está à espera de uma decisão nossa, depois quem ninguém perguntou ainda,
 * e o mais antigo à frente dentro de cada grupo.
 */

interface LeadRow {
  id: string; name: string; phone: string; city: string;
  message: string; stage: string; created_at: string; technician_name: string | null;
  category_id: string | null;
}

interface DispatchRow {
  lead_id: string; status: string; responded_at: string | null; created_at: string;
}

export interface DispatchPedido {
  leadId: string;
  nome: string;
  servico: string;
  /** Categoria canónica do catálogo — é ela que decide a quem perguntar. */
  categoria: string;
  cidade: string;
  urgencia: string;
  urgente: boolean;
  recebidoEm: string;
  perguntados: number;
  aceites: number;
  porResponder: number;
}

export interface DispatchBoardReal {
  pedidos: DispatchPedido[];
  kpis: {
    /** Pedidos sem técnico atribuído. */
    espera: number;
    /** Desses, quantos ainda não foram perguntados a ninguém. */
    porDifundir: number;
    /** Pedidos com pelo menos um técnico que aceitou e aguardam a nossa escolha. */
    porDecidir: number;
    /** Minutos entre difundir e a primeira aceitação. `null` sem histórico. */
    minutosAteAceitar: number | null;
  };
  migrated: boolean;
}

/** Estados de lead que já não estão à espera de técnico. */
const FECHADOS = ["concluido", "recusado", "reembolsado"];

export const GET = withStaff(async () => {
  const db = supabaseAdmin();

  const { data: leadsData, error } = await db
    .from("leads")
    .select("id, name, phone, city, message, stage, created_at, technician_name, category_id")
    .not("stage", "in", `(${FECHADOS.join(",")})`)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  // Um pedido com técnico escrito já saiu da fila, seja como lá tenha chegado.
  const abertos = ((leadsData ?? []) as LeadRow[])
    .filter((l) => !(l.technician_name || "").trim());

  let difusoes: DispatchRow[] = [];
  let migrated = true;
  if (abertos.length > 0) {
    const { data, error: dErr } = await db
      .from("lead_dispatches")
      .select("lead_id, status, responded_at, created_at")
      .in("lead_id", abertos.map((l) => l.id));
    if (dErr) {
      if (!isMissingTable(dErr, "lead_dispatches")) throw new Error(dErr.message);
      migrated = false;
    } else {
      difusoes = (data ?? []) as DispatchRow[];
    }
  }

  const porLead = new Map<string, DispatchRow[]>();
  for (const d of difusoes) {
    const lista = porLead.get(d.lead_id) ?? [];
    lista.push(d);
    porLead.set(d.lead_id, lista);
  }

  const pedidos: DispatchPedido[] = abertos.map((l) => {
    const ds = porLead.get(l.id) ?? [];
    const dados = extrairDadosLead(l.message || "", l.name || "");
    const urgencia = dados.urgencia || "";
    return {
      leadId: l.id,
      nome: l.name || l.phone || "Sem nome",
      servico: dados.servico || "Por identificar",
      categoria: categoryName(l.category_id || categoryFromMessage(l.message || "")),
      cidade: dados.localizacao || l.city || "",
      urgencia,
      urgente: /urgente/i.test(urgencia),
      recebidoEm: l.created_at,
      perguntados: ds.length,
      aceites: ds.filter((d) => d.status === "aceite").length,
      porResponder: ds.filter((d) => d.status === "enviado").length,
    };
  });

  /*
    A ordem é a ordem de trabalho, não a alfabética: quem já tem alguém a
    aceitar está à espera de nós e é o mais rápido de resolver; a seguir vem
    quem ninguém perguntou, que é o que se esquece.
  */
  pedidos.sort((a, b) => {
    const grupo = (p: DispatchPedido) => (p.aceites > 0 ? 0 : p.perguntados === 0 ? 1 : 2);
    return grupo(a) - grupo(b) || a.recebidoEm.localeCompare(b.recebidoEm);
  });

  // Tempo até a primeira aceitação, das difusões que já foram respondidas.
  const tempos = difusoes
    .filter((d) => d.status === "aceite" && d.responded_at)
    .map((d) => (new Date(d.responded_at!).getTime() - new Date(d.created_at).getTime()) / 60000)
    .filter((m) => m >= 0);

  return apiOk<DispatchBoardReal>({
    pedidos,
    kpis: {
      espera: pedidos.length,
      porDifundir: pedidos.filter((p) => p.perguntados === 0).length,
      porDecidir: pedidos.filter((p) => p.aceites > 0).length,
      minutosAteAceitar: tempos.length
        ? Math.round(tempos.reduce((s, m) => s + m, 0) / tempos.length)
        : null,
    },
    migrated,
  });
});
