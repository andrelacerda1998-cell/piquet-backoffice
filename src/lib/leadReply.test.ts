import { describe, it, expect } from "vitest";
import { extrairDadosLead, mensagemBoasVindas, eFormularioLanding } from "./leadReply";

const MSG_LANDING = [
  "*Novo pedido de serviço — Site Piquet*",
  "",
  "*Nome:* Andre Lacerda",
  "*Contacto:* 932429907",
  "*Localização:* Cascais",
  "*Serviço:* Canalização",
  "*Urgência:* Urgente (hoje ou amanhã)",
  "*Descrição:* teste",
  "",
  "_Enviado através do formulário de pedido em piquetapp.com_",
].join("\n");

describe("eFormularioLanding", () => {
  it("reconhece a mensagem do formulário da landing", () => {
    expect(eFormularioLanding(MSG_LANDING)).toBe(true);
  });
  it("ignora uma mensagem solta de WhatsApp", () => {
    expect(eFormularioLanding("olá, preciso de um canalizador")).toBe(false);
    expect(eFormularioLanding("Serviço: Canalização")).toBe(false); // sem marcador do formulário
  });
});

describe("extrairDadosLead", () => {
  it("lê o formato do formulário da landing entregue por WhatsApp", () => {
    const msg = [
      "*Novo pedido de serviço — Site Piquet*",
      "",
      "*Nome:* André Lacerda",
      "*Contacto:* 932429907",
      "*Localização:* Cascais",
      "*Serviço:* Canalização",
      "*Urgência:* Urgente (hoje ou amanhã)",
      "*Descrição:* teste",
    ].join("\n");
    expect(extrairDadosLead(msg)).toEqual({
      nome: "André Lacerda",
      servico: "Canalização",
      localizacao: "Cascais",
      urgencia: "Urgente (hoje ou amanhã)",
    });
  });

  it("lê o formato 'Serviço: X · Urgência: Y'", () => {
    const dados = extrairDadosLead("Serviço: Eletricidade · Urgência: normal\nQuadro a disparar");
    expect(dados.servico).toBe("Eletricidade");
    // A urgência decide com que pressa se procura técnico — é ela que vai no
    // pedido difundido à comunidade.
    expect(dados.urgencia).toBe("normal");
  });

  it("cai para o nome do perfil quando a mensagem não o traz", () => {
    expect(extrairDadosLead("olá, preciso de ajuda", "Maria").nome).toBe("Maria");
  });

  it("devolve campos vazios quando não há nada a extrair", () => {
    expect(extrairDadosLead("")).toEqual({ nome: "", servico: "", localizacao: "", urgencia: "" });
  });
});

describe("mensagemBoasVindas", () => {
  it("preenche nome, serviço e localização", () => {
    const t = mensagemBoasVindas({ nome: "André Lacerda", servico: "Canalização", localizacao: "Cascais" });
    expect(t).toContain("Olá, André.");
    expect(t).toContain("o seu pedido de Canalização em Cascais");
    expect(t).toContain("Equipa Piquet");
  });

  it("omite o serviço e a localização em falta sem deixar placeholders", () => {
    const t = mensagemBoasVindas({ nome: "", servico: "", localizacao: "" });
    expect(t).toContain("Olá.");
    expect(t).toContain("Recebemos o seu pedido e já estamos");
    expect(t).not.toMatch(/\[|\]/);
  });

  it("inclui a localização mesmo sem serviço", () => {
    const t = mensagemBoasVindas({ nome: "Rui", localizacao: "Sintra" });
    expect(t).toContain("o seu pedido em Sintra");
  });
});
