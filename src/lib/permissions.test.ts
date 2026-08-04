import { describe, it, expect } from "vitest";
import { ROLE_PERMISSIONS, ROLE_LABELS, hasPermission, canAccessRoute } from "./permissions";
import type { UserRole } from "@/types";

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS) as UserRole[];

describe("RBAC — integridade", () => {
  it("todos os perfis têm permissões e rótulo", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role].length, `${role} sem permissões`).toBeGreaterThan(0);
      expect(ROLE_LABELS[role], `${role} sem rótulo`).toBeTruthy();
    }
  });

  it("liderança e admin têm acesso total", () => {
    for (const role of ["ceo", "cto", "admin"] as UserRole[]) {
      expect(canAccessRoute(role, "/financeiro")).toBe(true);
      expect(canAccessRoute(role, "/configuracao")).toBe(true);
      expect(hasPermission(role, "manage_settings")).toBe(true);
      expect(hasPermission(role, "view_salaries")).toBe(true);
    }
  });

  it("nenhum perfil fica sem acesso a nada (o default 'operacoes' vê o essencial)", () => {
    for (const role of ALL_ROLES) {
      // Todos veem pelo menos a visão geral — corrige o bug de menu vazio.
      expect(canAccessRoute(role, "/")).toBe(true);
    }
  });
});

describe("RBAC — isolamento por domínio", () => {
  it("marketing não vê finanças, salários nem configurações", () => {
    expect(canAccessRoute("marketing", "/marketing")).toBe(true);
    expect(canAccessRoute("marketing", "/financeiro")).toBe(false);
    expect(canAccessRoute("marketing", "/configuracao")).toBe(false);
    expect(hasPermission("marketing", "view_salaries")).toBe(false);
    expect(hasPermission("marketing", "view_finance")).toBe(false);
  });

  it("operações gere serviços mas não vê finanças nem marketing", () => {
    expect(canAccessRoute("operacoes", "/servicos")).toBe(true);
    expect(canAccessRoute("operacoes", "/suporte")).toBe(true);
    expect(canAccessRoute("operacoes", "/financeiro")).toBe(false);
    expect(canAccessRoute("operacoes", "/marketing")).toBe(false);
    expect(canAccessRoute("operacoes", "/configuracao")).toBe(false);
  });

  it("financeiro vê finanças e RH, não marketing nem serviços", () => {
    expect(canAccessRoute("financeiro", "/financeiro")).toBe(true);
    expect(canAccessRoute("financeiro", "/impostos-rh")).toBe(true);
    expect(hasPermission("financeiro", "view_salaries")).toBe(true);
    expect(canAccessRoute("financeiro", "/marketing")).toBe(false);
    expect(canAccessRoute("financeiro", "/servicos")).toBe(false);
  });

  it("suporte vê clientes/serviços/tickets com dados pessoais, não finanças", () => {
    expect(canAccessRoute("suporte", "/suporte")).toBe(true);
    expect(canAccessRoute("suporte", "/clientes")).toBe(true);
    expect(hasPermission("suporte", "view_personal_data")).toBe(true);
    expect(canAccessRoute("suporte", "/financeiro")).toBe(false);
    expect(hasPermission("suporte", "view_salaries")).toBe(false);
  });

  it("gestão de técnicos vê técnicos e docs, não finanças", () => {
    expect(canAccessRoute("gestao_tecnicos", "/tecnicos")).toBe(true);
    expect(hasPermission("gestao_tecnicos", "upload_documents")).toBe(true);
    expect(canAccessRoute("gestao_tecnicos", "/financeiro")).toBe(false);
    expect(canAccessRoute("gestao_tecnicos", "/marketing")).toBe(false);
  });

  it("colaborador limitado só vê a visão geral", () => {
    expect(canAccessRoute("colaborador", "/")).toBe(true);
    expect(canAccessRoute("colaborador", "/financeiro")).toBe(false);
    expect(canAccessRoute("colaborador", "/servicos")).toBe(false);
    expect(canAccessRoute("colaborador", "/marketing")).toBe(false);
  });

  it("só quem tem manage_settings vê Configurações", () => {
    expect(canAccessRoute("ceo", "/configuracao")).toBe(true);
    expect(canAccessRoute("operacoes", "/configuracao")).toBe(false);
    expect(canAccessRoute("financeiro", "/configuracao")).toBe(false);
  });
});
