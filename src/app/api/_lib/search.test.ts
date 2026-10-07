import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => ({}) }));
vi.mock("@/lib/laravelAdmin", () => ({ laravelAdminRequest: vi.fn(), LARAVEL_ADMIN_ENABLED: false }));

import { fichaHref } from "./search";

describe("fichaHref — o ⌘K leva à ficha, não à lista", () => {
  it("junta o id e o nome à aba que já vem no endereço", () => {
    expect(fichaHref("/tecnicos?tab=lista", "tecnico", 7, "Rui Canalizador"))
      .toBe("/tecnicos?tab=lista&tecnico=7&q=Rui+Canalizador");
  });

  it("sem nome, só o id", () => {
    expect(fichaHref("/clientes?tab=lista", "cliente", 42, null)).toBe("/clientes?tab=lista&cliente=42");
    expect(fichaHref("/clientes?tab=lista", "cliente", 42, "  ")).toBe("/clientes?tab=lista&cliente=42");
  });

  it("um nome com & não parte o endereço", () => {
    const href = fichaHref("/clientes?tab=lista", "cliente", 1, "Silva & Filhos");
    expect(new URL(href, "http://x").searchParams.get("q")).toBe("Silva & Filhos");
  });
});
