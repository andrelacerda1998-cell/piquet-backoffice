import { supabaseAdmin } from "@/lib/supabase/server";
import { WHATSAPP_ENABLED, enviarTextoWhatsapp } from "@/lib/whatsapp";
import { primeiroNome } from "@/lib/leadReply";
import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";

/**
 * POST — atribuir o pedido a um dos técnicos que aceitaram.
 *
 * É o passo que fecha o ciclo: até aqui há gente que disse que pode ir, e
 * ninguém foi. Escreve o técnico na lead, avisa-o de que o serviço é dele e
 * avisa os outros que aceitaram de que desta vez não é -- porque ficar à espera
 * de uma resposta que nunca chega é o que faz um técnico deixar de responder
 * da próxima vez.
 */
export const POST = withStaff(async (req, { params, staff }) => {
  const b = (await req.json().catch(() => null)) as { technicianId?: string } | null;
  const technicianId = String(b?.technicianId ?? "").trim();
  if (!technicianId) return apiErr("Escolhe o técnico a quem atribuir.");

  const db = supabaseAdmin();

  const { data: lead, error: leadErr } = await db
    .from("leads").select("id, name, message").eq("id", params.id).maybeSingle();
  if (leadErr) throw new Error(leadErr.message);
  if (!lead) return apiErr("Pedido não encontrado.", 404);

  const { data: difusoes, error: dErr } = await db
    .from("lead_dispatches").select("*").eq("lead_id", params.id);
  if (dErr) throw new Error(dErr.message);

  type Row = { technician_id: string; technician_name: string; phone: string; status: string };
  const linhas = (difusoes ?? []) as Row[];
  const escolhido = linhas.find((d) => d.technician_id === technicianId);
  if (!escolhido) return apiErr("Esse técnico não foi contactado sobre este pedido.", 404);
  if (escolhido.status !== "aceite") {
    return apiErr("Só se pode atribuir a um técnico que tenha aceitado.", 409);
  }

  // O técnico fica escrito na lead — é o campo que a conversão em serviço usa.
  const { error: upErr } = await db.from("leads")
    .update({ technician_name: escolhido.technician_name, stage: "orcamento_aceite" })
    .eq("id", params.id);
  if (upErr) throw new Error(upErr.message);

  /*
    Avisos pelo WhatsApp. A janela está aberta com todos: cada um destes
    técnicos escreveu-nos ao aceitar, há minutos ou horas. Uma falha aqui não
    desfaz a atribuição -- fica registada e alguém liga.
  */
  const avisos: string[] = [];
  if (WHATSAPP_ENABLED) {
    const l = lead as { name: string };
    const cliente = primeiroNome(l.name || "") || "o cliente";

    const enviar = async (phone: string, corpo: string, quem: string) => {
      try {
        const { waMessageId } = await enviarTextoWhatsapp(phone, corpo);
        await db.from("whatsapp_messages").insert({
          lead_id: params.id, phone, direction: "out", body: corpo,
          wa_message_id: waMessageId || null, status: "sent", sent_by: staff.email,
        });
      } catch (e) {
        avisos.push(`${quem}: ${e instanceof Error ? e.message : "falha ao avisar"}`);
      }
    };

    await enviar(
      escolhido.phone,
      `O serviço é seu. Os dados de ${cliente} seguem já para si — obrigado pela disponibilidade.`,
      escolhido.technician_name || "técnico escolhido",
    );

    for (const outro of linhas) {
      if (outro.technician_id === technicianId || outro.status !== "aceite") continue;
      await enviar(
        outro.phone,
        "Obrigado pela disponibilidade. Desta vez o serviço ficou com outro técnico — falamos no próximo.",
        outro.technician_name || outro.technician_id,
      );
    }
  }

  return apiOk({ technicianName: escolhido.technician_name, avisos });
});
