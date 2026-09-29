import { describe, it, expect } from "vitest";
import {
  toTicketInbox, estadoParaInbox, estadoParaLaravel, idLaravelDe,
  ehTicketDeTecnico, importanciaDe, type TicketTecnicoLaravel,
} from "./ticketsTecnicos";

const base: TicketTecnicoLaravel = {
  id: 42,
  subject: "Validação da conta",
  message: "Ainda não recebi confirmação.",
  status: "open",
  admin_reply: null,
  replied_at: null,
  created_at: "2026-09-18T10:00:00Z",
  vendor: { id: 7, name: "Danúbia Trintrim", phone_number: "912345678" },
  is_no_show_dispute: false,
  disputed_service_id: null,
};

describe("ids", () => {
  it("prefixa para não colidir com os tickets do cliente", () => {
    // Os do Supabase são "TK-1104"; os do Laravel são inteiros. Sem prefixo,
    // responder a um escrevia no outro.
    expect(toTicketInbox(base).id).toBe("TEC-42");
    expect(ehTicketDeTecnico("TEC-42")).toBe(true);
    expect(ehTicketDeTecnico("TK-1104")).toBe(false);
  });

  it("volta a extrair o id do Laravel", () => {
    expect(idLaravelDe("TEC-42")).toBe(42);
  });

  it("recusa o que não é um id de técnico", () => {
    expect(idLaravelDe("TK-1104")).toBeNull();
    expect(idLaravelDe("TEC-")).toBeNull();
    expect(idLaravelDe("TEC-abc")).toBeNull();
    expect(idLaravelDe("TEC-0")).toBeNull();
  });
});

describe("estados", () => {
  it("traduz os três do Laravel", () => {
    expect(estadoParaInbox("open")).toBe("novo");
    expect(estadoParaInbox("answered")).toBe("em_curso");
    expect(estadoParaInbox("closed")).toBe("fechado");
  });

  it("um estado desconhecido cai em 'novo', não desaparece", () => {
    expect(estadoParaInbox("qualquer_coisa")).toBe("novo");
  });

  it("de volta, os cinco da caixa cabem nos três do Laravel", () => {
    expect(estadoParaLaravel("novo")).toBe("open");
    expect(estadoParaLaravel("em_curso")).toBe("answered");
    // Aguardar resposta do técnico é continuar em aberto do lado dele.
    expect(estadoParaLaravel("aguarda_cliente")).toBe("answered");
    expect(estadoParaLaravel("resolvido")).toBe("closed");
    expect(estadoParaLaravel("fechado")).toBe("closed");
  });

  it("um estado que o Laravel não sabe representar devolve null", () => {
    expect(estadoParaLaravel("inventado")).toBeNull();
  });
});

describe("toTicketInbox", () => {
  it("põe quem escreveu, com nome", () => {
    const t = toTicketInbox(base);
    expect(t.requesterName).toBe("Danúbia Trintrim");
    expect(t.requesterType).toBe("tecnico");
    expect(t.channel).toBe("app_tecnico");
  });

  it("sem nome usa o telefone, e sem telefone o número do técnico", () => {
    expect(toTicketInbox({ ...base, vendor: { id: 7, name: null, phone_number: "912345678" } }).requesterName)
      .toBe("912345678");
    expect(toTicketInbox({ ...base, vendor: { id: 7, name: "  ", phone_number: null } }).requesterName)
      .toBe("Técnico #7");
  });

  it("a mensagem do técnico é a primeira da conversa", () => {
    const t = toTicketInbox(base);
    expect(t.messages).toHaveLength(1);
    expect(t.messages[0]).toMatchObject({ from: "requester", body: "Ainda não recebi confirmação." });
  });

  it("a resposta da Piquet entra como segunda mensagem", () => {
    const t = toTicketInbox({ ...base, admin_reply: "Já verificámos.", replied_at: "2026-09-20T09:00:00Z", status: "answered" });
    expect(t.messages).toHaveLength(2);
    expect(t.messages[1]).toMatchObject({ from: "agente", authorName: "Suporte Piquet", at: "2026-09-20T09:00:00Z" });
    expect(t.lastMessageAt).toBe("2026-09-20T09:00:00Z");
  });

  it("resposta sem data usa a abertura, não 'agora'", () => {
    // Inventar `now()` punha o ticket no topo da caixa de cada vez que
    // alguém abrisse o ecrã.
    const t = toTicketInbox({ ...base, admin_reply: "x", replied_at: null });
    expect(t.messages[1].at).toBe("2026-09-18T10:00:00Z");
    expect(t.lastMessageAt).toBe("2026-09-18T10:00:00Z");
  });

  it("por responder conta como por ler", () => {
    expect(toTicketInbox(base).unread).toBe(1);
    expect(toTicketInbox({ ...base, admin_reply: "respondido" }).unread).toBe(0);
  });

  it("uma contestação de falta entra com importância alta", () => {
    // O técnico foi cobrado em metade do que ia receber: não pode ficar
    // atrás de "como mudo a foto de perfil".
    const d = { ...base, is_no_show_dispute: true, disputed_service_id: 4821, subject: "Contestação de falta — serviço #4821" };
    expect(importanciaDe(d)).toBe("alta");
    expect(toTicketInbox(d).priority).toBe("alta");
    expect(toTicketInbox(d).category).toBe("Contestação de falta");
  });

  it("uma dúvida normal fica em média e sem categoria", () => {
    expect(toTicketInbox(base).priority).toBe("media");
    expect(toTicketInbox(base).category).toBeUndefined();
  });

  it("aguenta um ticket sem assunto e sem data", () => {
    const t = toTicketInbox({ ...base, subject: "", created_at: null });
    expect(t.subject).toBe("(sem assunto)");
    expect(t.openedAt).toBe(new Date(0).toISOString());
  });
});
