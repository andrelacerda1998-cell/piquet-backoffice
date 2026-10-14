import { describe, it, expect } from "vitest";
import { classifyDocument, indexDocsByVendor, missingCount, atValidationState, atFlagWithoutProof, atDateLabel } from "./vendorDocs";
import type { VendorDocument } from "@/services/vendorDocumentsService";

const doc = (o: Partial<VendorDocument>): VendorDocument => ({
  id: 1, vendor_id: 1, vendor_name: "T", document_type: null, status: "pending",
  reason: null, expiration_date: null, file_url: null, created_at: null, ...o,
});

describe("classifyDocument — nomes do Laravel → documento obrigatório", () => {
  it("reconhece o Cartão de Cidadão nas várias escritas", () => {
    for (const t of ["Cartão de Cidadão", "cartao de cidadao", "CC", "Bilhete de Identidade", "Documento de identificação"]) {
      expect(classifyDocument(t)).toBe("cc");
    }
  });

  it("reconhece o Registo Criminal", () => {
    expect(classifyDocument("Registo Criminal")).toBe("criminal");
    expect(classifyDocument("Certidão de Registo Criminal")).toBe("criminal");
  });

  it("reconhece a Declaração de início de atividade", () => {
    expect(classifyDocument("Declaração de início de atividade")).toBe("atividade");
    expect(classifyDocument("declaracao inicio atividade financas")).toBe("atividade");
  });

  it("devolve null para o que não é obrigatório", () => {
    expect(classifyDocument("Comprovativo de IBAN")).toBeNull();
    expect(classifyDocument("")).toBeNull();
    expect(classifyDocument(null)).toBeNull();
  });
});

describe("indexDocsByVendor — estado por técnico", () => {
  it("agrupa por técnico e classifica cada documento", () => {
    const idx = indexDocsByVendor([
      doc({ id: 1, vendor_id: 7, document_type: "Cartão de Cidadão", status: "approved" }),
      doc({ id: 2, vendor_id: 7, document_type: "Registo Criminal", status: "pending" }),
      doc({ id: 3, vendor_id: 9, document_type: "Declaração de início de atividade", status: "declined" }),
    ]);
    expect(idx.get(7)).toEqual({ cc: "aprovado", criminal: "pendente", atividade: "em_falta" });
    expect(idx.get(9)).toEqual({ cc: "em_falta", criminal: "em_falta", atividade: "recusado" });
  });

  it("num reenvio vale o estado mais avançado (aprovado > pendente > recusado)", () => {
    const idx = indexDocsByVendor([
      doc({ id: 1, vendor_id: 3, document_type: "Registo Criminal", status: "declined" }),
      doc({ id: 2, vendor_id: 3, document_type: "Registo Criminal", status: "approved" }),
    ]);
    expect(idx.get(3)?.criminal).toBe("aprovado");
  });

  it("missingCount conta o que falta aprovar", () => {
    const idx = indexDocsByVendor([
      doc({ id: 1, vendor_id: 5, document_type: "Cartão de Cidadão", status: "approved" }),
    ]);
    expect(missingCount(idx.get(5))).toBe(2);
    expect(missingCount(undefined)).toBe(3);
  });
});

describe("atValidationState — a flag do backend não é prova de validação", () => {
  it("só é 'validado' quando há data de validação", () => {
    expect(atValidationState({ at_valid: true, at_validated_at: "2026-07-03" })).toBe("validado");
  });

  it("flag ligada mas sem data continua 'por validar' — o caso dos 37 técnicos em produção", () => {
    expect(atValidationState({ at_valid: true, at_validated_at: null })).toBe("por_validar");
    expect(atFlagWithoutProof({ at_valid: true, at_validated_at: null })).toBe(true);
  });

  it("sem flag e sem data é 'por validar'", () => {
    expect(atValidationState({ at_valid: false, at_validated_at: null })).toBe("por_validar");
  });

  /**
   * O defeito de 14/10/2026: "Retirar AT", credenciais recusadas ao validar ou
   * ao faturar -- o backend desliga a flag e guarda a data da última vez que
   * funcionou. Contava como validado só pela data.
   */
  it("com data mas sem a flag é 'por validar': a AT deixou de valer", () => {
    expect(atValidationState({ at_valid: false, at_validated_at: "2026-10-14T15:21:01+00:00" })).toBe("por_validar");
  });
});

describe("atDateLabel — o que a data quer dizer", () => {
  it("validado: a data é a da validação, sem mais nada", () => {
    expect(atDateLabel({ at_valid: true, at_validated_at: "2026-10-14" })).toBe("");
  });

  it("por validar com data: é a última vez que funcionou", () => {
    expect(atDateLabel({ at_valid: false, at_validated_at: "2026-10-14" })).toBe("última vez OK a ");
  });

  it("sem data não há nada a mostrar", () => {
    expect(atDateLabel({ at_valid: true, at_validated_at: null })).toBeNull();
    expect(atDateLabel({ at_valid: false, at_validated_at: null })).toBeNull();
  });
});
