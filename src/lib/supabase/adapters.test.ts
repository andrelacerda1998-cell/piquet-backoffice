import { describe, it, expect } from "vitest";
import { rowToService, rowToCustomer, serviceSortColumn, type ServiceRow, type CustomerRow } from "@/lib/supabase/adapters";

const baseServiceRow: ServiceRow = {
  id: "srv_1", customer_id: "c1", technician_id: "t1", category_id: "cat_canalizacao",
  service_name: "Desentupimento", location: "Rua X", city: "Lisboa", source: "App",
  status: "concluido", requested_at: "2026-06-01T10:00:00Z", scheduled_at: null,
  started_at: null, completed_at: "2026-06-02T12:00:00Z", total_customer_value: 100,
  technician_value: 65, piquet_revenue: 35, vat_value: 8, payment_status: "pago",
  invoice_status: "emitida", rating: 4.8, has_complaint: false, cancellation_reason: null,
  response_time_minutes: 12, technician_assignment_time_min: 30, campaign_id: null,
  internal_notes: null, customer_name: "Ana", technician_name: "Rui", category_name: "Canalização",
};

describe("rowToService", () => {
  it("mapeia snake_case → camelCase e junta os nomes por relação", () => {
    const s = rowToService(baseServiceRow);
    expect(s.id).toBe("srv_1");
    expect(s.customerName).toBe("Ana");
    expect(s.technicianName).toBe("Rui");
    expect(s.categoryName).toBe("Canalização");
    expect(s.totalCustomerValue).toBe(100);
    expect(s.piquetRevenue).toBe(35);
    expect(s.technicianAssignmentTimeMinutes).toBe(30);
    expect(s.internalNotes).toEqual([]);
  });

  it("converte null em undefined nos campos opcionais", () => {
    const s = rowToService({ ...baseServiceRow, scheduled_at: null, rating: null, technician_id: null });
    expect(s.scheduledAt).toBeUndefined();
    expect(s.rating).toBeUndefined();
    expect(s.technicianId).toBeUndefined();
  });
});

describe("serviceSortColumn", () => {
  it("traduz o campo do frontend para a coluna Postgres", () => {
    expect(serviceSortColumn("totalCustomerValue")).toBe("total_customer_value");
    expect(serviceSortColumn("requestedAt")).toBe("requested_at");
  });
  it("cai em requested_at para campos desconhecidos ou vazios", () => {
    expect(serviceSortColumn("qualquerCoisa")).toBe("requested_at");
    expect(serviceSortColumn(undefined)).toBe("requested_at");
  });
});

describe("rowToCustomer", () => {
  it("mapeia e traz as métricas da vista _enriched", () => {
    const row: CustomerRow = {
      id: "c1", name: "Ana", email: "ana@x.pt", phone: "911", registered_at: "2026-01-01",
      location: "Lisboa", city: "Lisboa", status: "recorrente", source: "App",
      service_count: 4, total_spent: 400, piquet_revenue: 140, last_service_at: "2026-06-02",
      complaint_count: 1, average_rating: 4.6,
    };
    const c = rowToCustomer(row);
    expect(c.serviceCount).toBe(4);
    expect(c.totalSpent).toBe(400);
    expect(c.piquetRevenue).toBe(140);
    expect(c.complaintCount).toBe(1);
    expect(c.averageRating).toBe(4.6);
  });
});
