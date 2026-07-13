import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeSupabaseMock, setTable, resetMock, mockState } from "@/test/supabaseMock";

// `server-only` rebenta fora de RSC — no-op nos testes.
vi.mock("server-only", () => ({}));
// Mocka o cliente Supabase (hoisted) — todos os imports do grafo usam o mock.
vi.mock("@/lib/supabase/server", () => makeSupabaseMock());

import { GET as servicesGET } from "@/app/api/services/route";
import { GET as customersMetricsGET } from "@/app/api/customers/metrics/route";
import { POST as messagesPOST } from "@/app/api/team/messages/route";
import { PUT as payoutProcessPUT } from "@/app/api/finance/payouts/[id]/process/route";
import { _clearStaffCache } from "@/app/api/_lib/handler";

function req(url: string, init?: RequestInit) {
  return new Request(url, { headers: { authorization: "Bearer tok" }, ...init });
}
function ctx(params: Record<string, string> = {}) {
  return { params: Promise.resolve(params) };
}

beforeEach(() => { resetMock(); _clearStaffCache(); });

describe("withStaff (autenticação)", () => {
  it("401 sem token", async () => {
    const res = await servicesGET(new Request("http://localhost/api/services"), ctx());
    expect(res.status).toBe(401);
  });

  it("401 quando o token é inválido", async () => {
    mockState.authError = true;
    const res = await servicesGET(req("http://localhost/api/services"), ctx());
    expect(res.status).toBe(401);
  });
});

describe("GET /api/services", () => {
  it("mapeia, achata o embed (objeto) e devolve envelope paginado", async () => {
    setTable("services", {
      data: [{
        id: "s1", customer_id: "c1", technician_id: "t1", category_id: "cat_x", service_name: "Reparação",
        status: "concluido", requested_at: "2026-06-01", total_customer_value: 100, technician_value: 60,
        piquet_revenue: 40, vat_value: 9, payment_status: "pago", invoice_status: "emitida", has_complaint: false,
        internal_notes: null, customer: { name: "Ana" }, technician: { name: "Rui" }, category: { name: "Canalização" },
      }],
      count: 1, error: null,
    });
    const res = await servicesGET(req("http://localhost/api/services?page=1&pageSize=20"), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(1);
    expect(body.data.totalPages).toBe(1);
    expect(body.data.data[0].customerName).toBe("Ana");
    expect(body.data.data[0].categoryName).toBe("Canalização");
    expect(body.data.data[0].piquetRevenue).toBe(40);
  });

  it("achata o embed quando vem como ARRAY (cardinalidade PostgREST)", async () => {
    setTable("services", {
      data: [{
        id: "s2", customer_id: "c1", service_name: "X", status: "concluido", requested_at: "2026-06-01",
        total_customer_value: 0, technician_value: 0, piquet_revenue: 0, vat_value: 0,
        payment_status: "pendente", invoice_status: "nao_emitida", has_complaint: false, internal_notes: null,
        customer: [{ name: "Beatriz" }], technician: null, category: [{ name: "Eletricidade" }],
      }],
      count: 1, error: null,
    });
    const res = await servicesGET(req("http://localhost/api/services"), ctx());
    const body = await res.json();
    expect(body.data.data[0].customerName).toBe("Beatriz");
    expect(body.data.data[0].categoryName).toBe("Eletricidade");
    expect(body.data.data[0].technicianName).toBeUndefined(); // técnico null → opcional
  });
});

describe("GET /api/customers/metrics", () => {
  it("agrega os indicadores a partir da vista enriched", async () => {
    setTable("customers_enriched", {
      data: [
        { status: "recorrente", service_count: 5, complaint_count: 1, piquet_revenue: 200, average_rating: 4.5, registered_at: "2026-06-20" },
        { status: "ativo", service_count: 1, complaint_count: 0, piquet_revenue: 50, average_rating: 4, registered_at: "2025-01-01" },
        { status: "inativo", service_count: 0, complaint_count: 0, piquet_revenue: 0, average_rating: 0, registered_at: "2024-01-01" },
      ],
      error: null,
    });
    const res = await customersMetricsGET(req("http://localhost/api/customers/metrics"), ctx());
    const body = await res.json();
    expect(body.data.registered).toBe(3);
    expect(body.data.recurring).toBe(1);   // service_count>=3 ou status recorrente
    expect(body.data.oneTime).toBe(1);
    expect(body.data.inactive).toBe(1);
    expect(body.data.withComplaints).toBe(1);
  });
});

describe("POST /api/team/messages", () => {
  it("insere e devolve a mensagem como própria do autor", async () => {
    setTable("team_messages", {
      data: { id: "m1", thread_id: "geral", author_id: "staff-1", author_name: "Ana Silva", text: "Olá", created_at: "2026-07-06T09:00:00Z" },
      error: null,
    });
    const res = await messagesPOST(
      req("http://localhost/api/team/messages", { method: "POST", body: JSON.stringify({ threadId: "geral", author: "Ana Silva", text: "Olá" }) }),
      ctx()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.threadId).toBe("geral");
    expect(body.data.own).toBe(true);
    expect(body.data.initials).toBe("AS");
  });

  it("400 quando falta o texto", async () => {
    const res = await messagesPOST(
      req("http://localhost/api/team/messages", { method: "POST", body: JSON.stringify({ threadId: "geral" }) }),
      ctx()
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/finance/payouts/:id/process", () => {
  it("marca o pagamento como processado", async () => {
    setTable("technician_payouts", {
      data: { id: "payout_1", technician_name: "Rui", services: 5, amount_due: 300, period: "Junho 2026", status: "processado" },
      error: null,
    });
    const res = await payoutProcessPUT(req("http://localhost/api/finance/payouts/payout_1/process", { method: "PUT" }), ctx({ id: "payout_1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("processado");
    expect(body.data.technicianName).toBe("Rui");
  });
});
