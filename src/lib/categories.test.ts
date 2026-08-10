import { describe, it, expect } from "vitest";
import { resolveCategoryId, categoryName, categoryFromMessage } from "./categories";

describe("resolveCategoryId — categoria da landing → id canónico", () => {
  it("resolve pelo nome exato (com acentos)", () => {
    expect(resolveCategoryId("Canalização")).toBe("cat_canalizacao");
    expect(resolveCategoryId("Fechaduras e portas")).toBe("cat_fechaduras");
  });

  it("resolve pelo slug e pelo id", () => {
    expect(resolveCategoryId("canalizacao")).toBe("cat_canalizacao");
    expect(resolveCategoryId("cat_canalizacao")).toBe("cat_canalizacao");
  });

  it("é tolerante a acentos, maiúsculas e espaços", () => {
    expect(resolveCategoryId("  CANALIZAÇÃO  ")).toBe("cat_canalizacao");
    expect(resolveCategoryId("eletricidade")).toBe("cat_eletricidade");
    expect(resolveCategoryId("AVAC")).toBe("cat_avac");
  });

  it("resolve por correspondência parcial do nome", () => {
    expect(resolveCategoryId("Canalização e água")).toBe("cat_canalizacao");
    expect(resolveCategoryId("Montagem de mobiliário IKEA")).toBe("cat_mobiliario");
  });

  it("devolve '' quando nada corresponde ou vem vazio", () => {
    expect(resolveCategoryId("Jardinagem")).toBe("");
    expect(resolveCategoryId("")).toBe("");
    expect(resolveCategoryId(undefined)).toBe("");
    expect(resolveCategoryId(123)).toBe("");
  });

  it("categoryName devolve o nome legível do id", () => {
    expect(categoryName("cat_avac")).toBe("AVAC");
    expect(categoryName("inexistente")).toBe("");
  });
});

describe("categoryFromMessage — extrair a categoria da mensagem da landing", () => {
  it("extrai o 'Serviço: X' e resolve para o id canónico", () => {
    expect(categoryFromMessage("Serviço: Canalização · Urgência: Normal\nTorneira a pingar")).toBe("cat_canalizacao");
    expect(categoryFromMessage("Serviço: Eletricidade · Urgência: Urgente")).toBe("cat_eletricidade");
  });

  it("devolve '' quando o serviço não corresponde a uma categoria ou não há mensagem", () => {
    expect(categoryFromMessage("Serviço: Eletrodomésticos · Urgência: Normal")).toBe("");
    expect(categoryFromMessage("Olá, preciso de ajuda")).toBe("");
    expect(categoryFromMessage(null)).toBe("");
    expect(categoryFromMessage("")).toBe("");
  });
});
