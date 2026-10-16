import { describe, it, expect } from "vitest";
import { CAMPANHA_VAZIA, problemasDaCampanha, resumoDaFrequencia, soOsCampos, temIngles, publicoDe, type DadosDaCampanha } from "./campanhasPush";

const completa: DadosDaCampanha = {
  ...CAMPANHA_VAZIA,
  name: "Voltar a pedir",
  title: { "pt-pt": "Precisas de um canalizador?", en: "" },
  body: { "pt-pt": "Há técnicos na tua zona.", en: "" },
};

describe("campanhas de push no backoffice", () => {
  it("uma campanha com nome, título e texto pode gravar", () => {
    expect(problemasDaCampanha(completa)).toEqual([]);
  });

  it("diz o que falta", () => {
    expect(problemasDaCampanha(CAMPANHA_VAZIA)).toEqual([
      "Falta o nome da campanha.", "Falta o título em português.", "Falta o texto em português.",
    ]);
  });

  /** No Filament dava para mandar push a toda a gente de minuto a minuto. */
  it("um intervalo personalizado não fica abaixo de uma hora", () => {
    const de = (valor: number, unidade: "minutes" | "hours" | "days") =>
      problemasDaCampanha({ ...completa, frequency_type: "custom", frequency_value: valor, frequency_unit: unidade });

    expect(de(30, "minutes")).toEqual(["O intervalo mínimo é de uma hora."]);
    expect(de(60, "minutes")).toEqual([]);
    expect(de(1, "days")).toEqual([]);
  });

  it("o que abre e as datas têm de fazer sentido", () => {
    expect(problemasDaCampanha({ ...completa, open_type: "OperationArea", open_id: null }))
      .toEqual(["Escolhe o que a notificação abre, ou nada."]);
    expect(problemasDaCampanha({ ...completa, starts_at: "2026-10-20T10:00:00Z", ends_at: "2026-10-19T10:00:00Z" }))
      .toEqual(["O fim tem de ser depois do início."]);
  });

  it("o inglês conta quando há texto em inglês", () => {
    expect(temIngles(completa)).toBe(false);
    expect(temIngles({ ...completa, title: { "pt-pt": "Olá", en: "Hi" } })).toBe(true);
  });

  it("a frequência lê-se", () => {
    expect(resumoDaFrequencia({ frequency_type: "once" })).toBe("Uma vez");
    expect(resumoDaFrequencia({ frequency_type: "custom", frequency_value: 3, frequency_unit: "hours" })).toBe("De 3 em 3 horas");
    expect(resumoDaFrequencia({ frequency_type: "custom", frequency_value: 1, frequency_unit: "days" })).toBe("De 1 em 1 dia");
  });

  /** Ligada à nascença não: o corpo que segue para o Laravel só leva os campos da campanha. */
  it("só seguem para o Laravel os campos da campanha", () => {
    const corpo = soOsCampos({ ...completa, is_active: true, last_sent_at: "2026-10-01T00:00:00Z" });

    expect(corpo).not.toHaveProperty("is_active");
    expect(corpo).not.toHaveProperty("last_sent_at");
    expect(corpo).toMatchObject({ name: "Voltar a pedir", target_type: "customer" });
  });

  it("a contagem leva só o público", () => {
    expect(Object.keys(publicoDe(completa)).sort()).toEqual([
      "customer_never_requested", "inactive_days", "target_type", "user_status", "vendor_eligibility", "vendor_missing_schedule_address",
    ]);
  });
});
