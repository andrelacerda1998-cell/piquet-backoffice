import { apiOk, apiErr, withStaff } from "../../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";
import { motivoValido } from "@/lib/motivo";
import { anularRegisto, registarAcao } from "../../../../_lib/acoesDaEquipa";
import type { PushCampaign } from "../../route";

/**
 * PUT — ligar ou desligar uma campanha de push.
 *
 * LIGAR é mandar push a quem estiver no público: pede o motivo, que fica no
 * histórico da equipa em nome de quem ligou, com o número de pessoas que o
 * ecrã lhe mostrou. É gravado ANTES e retirado se a campanha não ligar (o
 * Laravel recusa, por exemplo, com o inglês por rever).
 *
 * DESLIGAR é o travão: um clique, sem motivo obrigatório, registado quando o
 * histórico deixa, e feito mesmo quando não deixa.
 */
export const PUT = withStaff(async (req, { params, staff }) => {
  if (!/^\d+$/.test(params.id)) return apiErr("Campanha não encontrada.", 404);
  const b = (await req.json().catch(() => null)) as { active?: boolean; motivo?: unknown; pessoas?: unknown } | null;
  if (typeof b?.active !== "boolean") return apiErr("Falta dizer se fica ligada ou desligada.");

  let motivo: string;
  if (b.active) {
    const m = motivoValido(b.motivo);
    if (!m) return apiErr("Escreve porque ligas a campanha (pelo menos 5 letras). Fica registado com o teu nome.", 422);
    motivo = m;
  } else {
    motivo = motivoValido(b.motivo) ?? "Desligada no backoffice";
  }

  const pessoas = typeof b.pessoas === "number" ? b.pessoas : null;
  const registo = await registarAcao(
    staff, b.active ? "ligar_campanha_push" : "desligar_campanha_push", "campanha", params.id, motivo,
    pessoas !== null ? { pessoas } : undefined,
  );
  // Ligar sem registo não se faz; desligar faz-se sempre: um travão que
  // depende de o histórico gravar deixava uma campanha errada a correr.
  if (!registo.ok && b.active) return apiErr(registo.erro, registo.status);
  if (!registo.ok) console.error("[campanhas push] desligada sem registo:", registo.erro);

  try {
    return apiOk(await laravelAdminRequest<PushCampaign>(
      `/v1/admin/notification-campaigns/${params.id}/active`,
      { method: "PUT", body: { active: b.active }, staff: { email: staff.email, nome: staff.name } },
    ));
  } catch (e) {
    if (registo.ok) await anularRegisto(registo.id);
    return apiErr(
      e instanceof ApiError ? e.message : "Não foi possível mudar o estado da campanha.",
      e instanceof ApiError ? e.status : 500,
    );
  }
});
