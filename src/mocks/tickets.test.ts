import { describe, it, expect } from "vitest";
import { generateSupportTickets } from "@/mocks/data";

describe("generateSupportTickets — conversa", () => {
  const tickets = generateSupportTickets(35);

  it("todos os tickets têm pelo menos a mensagem inicial do cliente", () => {
    tickets.forEach((t) => {
      expect(t.messages.length).toBeGreaterThanOrEqual(1);
      expect(t.messages[0].author).toBe("cliente");
    });
  });

  it("tickets não-novos têm resposta de agente", () => {
    tickets
      .filter((t) => t.status !== "novo")
      .forEach((t) => {
        expect(t.messages.some((m) => m.author === "agente")).toBe(true);
      });
  });

  it("tickets resolvidos têm resolvedAt e mais mensagens", () => {
    tickets
      .filter((t) => t.status === "resolvido")
      .forEach((t) => {
        expect(t.resolvedAt).toBeTruthy();
        expect(t.messages.length).toBeGreaterThanOrEqual(2);
      });
  });

  it("tickets novos não têm resolvedAt", () => {
    tickets
      .filter((t) => t.status === "novo")
      .forEach((t) => expect(t.resolvedAt).toBeUndefined());
  });
});
