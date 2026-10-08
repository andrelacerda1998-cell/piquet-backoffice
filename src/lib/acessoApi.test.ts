import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { POLITICA, podeChamar, requisitoDe } from "./acessoApi";

/** Os ficheiros de rotas protegidos por `withStaff`, com os métodos que exportam. */
function rotasDeStaff(): { chave: string; caminho: string }[] {
  const raiz = join(process.cwd(), "src/app/api");
  const out: { chave: string; caminho: string }[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) { andar(p); continue; }
      if (nome !== "route.ts") continue;
      const codigo = readFileSync(p, "utf8");
      if (!codigo.includes("withStaff(")) continue;
      const template = "/" + relative(raiz, dir).split(sep).join("/");
      const metodos = [...codigo.matchAll(/export (?:const|async function) (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
      for (const metodo of metodos) {
        out.push({ chave: `${metodo} ${template}`, caminho: "/api" + template.replace(/\[[^\]]+\]/g, "123") });
      }
    }
  };
  andar(raiz);
  return out;
}

describe("a política cobre a API inteira", () => {
  const rotas = rotasDeStaff();

  it("encontra as rotas (o teste não está a olhar para o sítio errado)", () => {
    expect(rotas.length).toBeGreaterThan(100);
  });

  it("toda a rota de staff tem uma linha — senão é recusada a toda a gente", () => {
    const sem = rotas.filter((r) => !(r.chave in POLITICA)).map((r) => r.chave);
    expect(sem, "rotas sem permissão decidida em src/lib/acessoApi.ts").toEqual([]);
  });

  it("e a linha certa é a que se aplica ao pedido", () => {
    for (const r of rotas) {
      const [metodo] = r.chave.split(" ");
      expect(requisitoDe(metodo, r.caminho), r.chave).toBe(POLITICA[r.chave]);
    }
  });

  it("não há linhas para rotas que já não existem", () => {
    const existentes = new Set(rotas.map((r) => r.chave));
    const orfas = Object.keys(POLITICA).filter((k) => !existentes.has(k));
    expect(orfas).toEqual([]);
  });
});

describe("o que cada perfil pode fazer", () => {
  it("marketing não lê pagamentos, salários nem códigos SMS", () => {
    expect(podeChamar("marketing", "GET", "/api/finance/app-payments")).toBe(false);
    expect(podeChamar("marketing", "GET", "/api/employees")).toBe(false);
    expect(podeChamar("marketing", "GET", "/api/sms-codes")).toBe(false);
    expect(podeChamar("marketing", "GET", "/api/marketing/campaigns")).toBe(true);
  });

  it("só quem gere dinheiro reembolsa e paga técnicos", () => {
    expect(podeChamar("financeiro", "POST", "/api/finance/payout-lotes/ab-12/pagar")).toBe(true);
    expect(podeChamar("financeiro", "POST", "/api/finance/app-payments/ab-12/refund")).toBe(true);
    for (const role of ["operacoes", "suporte", "marketing", "gestao_tecnicos", "colaborador", "developer"]) {
      expect(podeChamar(role, "POST", "/api/finance/payout-lotes/ab-12/pagar"), role).toBe(false);
      expect(podeChamar(role, "POST", "/api/finance/payout-lotes/ab-12/aprovar"), role).toBe(false);
      expect(podeChamar(role, "POST", "/api/finance/app-payments/ab-12/refund"), role).toBe(false);
    }
  });

  it("apagar um técnico de vez exige gerir técnicos E ações destrutivas", () => {
    expect(podeChamar("operacoes", "DELETE", "/api/technicians/3/permanent")).toBe(true);
    expect(podeChamar("gestao_tecnicos", "DELETE", "/api/technicians/3/permanent")).toBe(false);
    expect(podeChamar("gestao_tecnicos", "PUT", "/api/technicians/3/suspend")).toBe(true);
  });

  it("os códigos SMS só para o suporte, que também vê dados pessoais", () => {
    expect(podeChamar("suporte", "GET", "/api/sms-codes")).toBe(true);
    expect(podeChamar("operacoes", "GET", "/api/sms-codes")).toBe(false);
  });

  it("ler um serviço não chega para o alterar", () => {
    expect(podeChamar("suporte", "GET", "/api/services/282")).toBe(true);
    expect(podeChamar("suporte", "PUT", "/api/services/282")).toBe(false);
    expect(podeChamar("operacoes", "PUT", "/api/services/282")).toBe(true);
  });

  it("a página inicial funciona para todos os perfis", () => {
    for (const role of ["ceo", "cto", "admin", "operacoes", "financeiro", "marketing", "suporte", "gestao_tecnicos", "developer", "colaborador"]) {
      for (const rota of ["/api/finance/gmv", "/api/finance/summary", "/api/finance/unit-economics", "/api/services/counts", "/api/goals", "/api/product/growth", "/api/search?q=ana"]) {
        expect(podeChamar(role, "GET", rota), `${role} ${rota}`).toBe(true);
      }
    }
  });

  it("liderança e admin fazem tudo", () => {
    for (const chave of Object.keys(POLITICA)) {
      const [metodo, caminho] = chave.split(" ");
      const exemplo = "/api" + caminho.replace(/\[[^\]]+\]/g, "1");
      for (const role of ["ceo", "cto", "admin"]) {
        expect(podeChamar(role, metodo, exemplo), `${role} ${chave}`).toBe(true);
      }
    }
  });
});

describe("como se lê o pedido", () => {
  it("um segmento fixo ganha ao dinâmico: /services/counts não é o serviço 'counts'", () => {
    expect(podeChamar("colaborador", "GET", "/api/services/counts")).toBe(true);
    expect(podeChamar("colaborador", "GET", "/api/services/123")).toBe(false);
  });

  it("um perfil desconhecido não pode nada", () => {
    expect(podeChamar("estagiario", "GET", "/api/finance/gmv")).toBe(false);
    expect(podeChamar("", "GET", "/api/goals")).toBe(false);
  });

  it("uma rota fora da política é recusada", () => {
    expect(requisitoDe("GET", "/api/rota-que-nao-existe")).toBeNull();
    expect(podeChamar("ceo", "GET", "/api/rota-que-nao-existe")).toBe(false);
  });

  it("um método que a rota não tem é recusado", () => {
    expect(podeChamar("ceo", "DELETE", "/api/finance/gmv")).toBe(false);
  });

  it("HEAD vale como GET; a query e a barra final não contam", () => {
    expect(podeChamar("marketing", "HEAD", "/api/marketing/leads")).toBe(true);
    expect(podeChamar("marketing", "GET", "/api/marketing/leads/?page=2")).toBe(true);
  });

  it("um id não deixa saltar de rota", () => {
    expect(requisitoDe("POST", "/api/finance/payout-lotes/7/pagar/extra")).toBeNull();
    expect(requisitoDe("POST", "/api/finance/payout-lotes//pagar")).toBeNull();
    // O pagar direto saiu: já nem a liderança o pode chamar.
    expect(requisitoDe("PUT", "/api/vendor-payments/7/pay")).toBeNull();
  });
});
