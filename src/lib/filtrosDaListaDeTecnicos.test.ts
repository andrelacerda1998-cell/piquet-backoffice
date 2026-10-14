import { describe, it, expect } from "vitest";
import { filtrarTecnicos, type TecnicoFiltravel } from "./filtrosDaListaDeTecnicos";

const t = (id: number, o: Partial<TecnicoFiltravel> = {}): TecnicoFiltravel => ({
  id, can_accept_service: false, all_documents_verified: false, at_valid: false, at_validated_at: null, ...o,
});

const lista = [
  t(1, { can_accept_service: true, all_documents_verified: true, at_valid: true, at_validated_at: "2026-10-01" }),
  t(2, { can_accept_service: true, all_documents_verified: true }),
  // Perdeu a AT (flag desligada, data da última vez que funcionou).
  t(3, { can_accept_service: true, all_documents_verified: true, at_validated_at: "2026-09-01" }),
  // Já fez os 3 serviços e não tem AT: não pode trabalhar.
  t(4, { all_documents_verified: true }),
  // Entregou o Cartão de Cidadão, falta o resto.
  t(5),
  // Nunca entregou nada.
  t(6),
];
const entregaram = new Set([1, 2, 3, 4, 5]);

describe("filtrarTecnicos", () => {
  it("AT validado: a flag e a data", () => {
    expect(filtrarTecnicos(lista, "at_validado", entregaram).map((v) => v.id)).toEqual([1]);
  });

  /** Os que trabalham sem a AT, até ao terceiro serviço. */
  it("só falta AT: podem trabalhar e a AT está por validar (incluindo quem a perdeu)", () => {
    expect(filtrarTecnicos(lista, "so_falta_at", entregaram).map((v) => v.id)).toEqual([2, 3]);
  });

  it("falta documentos: só quem já entregou algum", () => {
    expect(filtrarTecnicos(lista, "falta_documentos", entregaram).map((v) => v.id)).toEqual([5]);
  });

  it("sem o campo dos documentos (backend antigo) não se adivinha", () => {
    const semCampo = [{ ...t(7), all_documents_verified: undefined }];
    expect(filtrarTecnicos(semCampo, "falta_documentos", new Set([7]))).toEqual([]);
  });
});
