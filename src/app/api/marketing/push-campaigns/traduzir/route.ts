import { apiOk, apiErr, withStaff } from "../../../_lib/handler";
import { laravelAdminRequest } from "@/lib/laravelAdmin";
import { ApiError } from "@/services/http";

/**
 * POST — um rascunho do inglês a partir do português, como o botão do
 * Filament. Não grava nada: a pessoa revê, corrige e marca como revisto.
 */
export const POST = withStaff(async (req) => {
  const b = (await req.json().catch(() => null)) as { title?: unknown; body?: unknown } | null;
  const texto = (v: unknown) => (typeof v === "string" ? v.slice(0, 1000) : "");
  try {
    return apiOk(await laravelAdminRequest<{ title: string; body: string }>("/v1/admin/notification-campaigns/traduzir", {
      method: "POST",
      body: { title: texto(b?.title).slice(0, 255), body: texto(b?.body) },
    }));
  } catch (e) {
    return apiErr(e instanceof ApiError ? e.message : "Não foi possível traduzir.", e instanceof ApiError ? e.status : 500);
  }
});
