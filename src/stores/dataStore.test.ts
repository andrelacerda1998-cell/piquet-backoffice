import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "@/stores";

function reset() {
  useDataStore.setState({ ticketReplies: {}, ticketStatus: {}, extraInvoices: [], invoicePaid: {} });
}

describe("useDataStore — overlay de mutações persistido", () => {
  beforeEach(reset);

  it("acrescenta respostas a um ticket", () => {
    const msg = { id: "m1", author: "agente" as const, authorName: "Ana", body: "Olá", at: "2026-07-03" };
    useDataStore.getState().addTicketReply("t1", msg);
    expect(useDataStore.getState().ticketReplies.t1).toEqual([msg]);
    useDataStore.getState().addTicketReply("t1", { ...msg, id: "m2" });
    expect(useDataStore.getState().ticketReplies.t1).toHaveLength(2);
  });

  it("define o estado de um ticket", () => {
    useDataStore.getState().setTicketStatus("t1", "resolvido");
    expect(useDataStore.getState().ticketStatus.t1).toBe("resolvido");
  });

  it("acrescenta faturas no topo e marca pagas", () => {
    const inv = { id: "i1", number: "FT 2026/1", entity: "ACME", description: "—", amount: 100, issueDate: "2026-07-03", dueDate: "2026-07-31", status: "pendente" as const };
    useDataStore.getState().addInvoice(inv);
    expect(useDataStore.getState().extraInvoices[0]).toEqual(inv);
    useDataStore.getState().markInvoicePaid("i1");
    expect(useDataStore.getState().invoicePaid.i1).toBe(true);
  });
});
