import { describe, it, expect, vi } from "vitest";

// `server-only` rebenta fora de RSC — no-op nos testes.
vi.mock("server-only", () => ({}));

import { parseAppleSalesTsv } from "@/app/api/_lib/appstore";
import { parseInstallsCsv } from "@/app/api/_lib/googleplay";

describe("parseAppleSalesTsv (Sales Reports da App Store Connect)", () => {
  const HEADER = "Provider\tProvider Country\tSKU\tDeveloper\tTitle\tVersion\tProduct Type Identifier\tUnits";

  it("extrai SKU, unidades e tipo de produto", () => {
    const tsv = [
      HEADER,
      "APPLE\tUS\tPIQUET.CLIENTE\tPiquet\tPiquet\t1.4.2\t1\t37",
      "APPLE\tUS\tPIQUET.PRO\tPiquet\tPiquet Profissional\t1.2.0\t1\t9",
      "APPLE\tUS\tPIQUET.CLIENTE\tPiquet\tPiquet\t1.4.2\t7\t120", // 7 = update, não é download
    ].join("\n");
    const rows = parseAppleSalesTsv(tsv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ sku: "PIQUET.CLIENTE", units: 37, productTypeIdentifier: "1" });
    expect(rows[1].units).toBe(9);
    expect(rows[2].productTypeIdentifier).toBe("7");
  });

  it("é resiliente a relatório vazio ou sem colunas esperadas", () => {
    expect(parseAppleSalesTsv("")).toEqual([]);
    expect(parseAppleSalesTsv("So\tCabecalho")).toEqual([]);
    expect(parseAppleSalesTsv("A\tB\nx\ty")).toEqual([]);
  });

  it("trata unidades não numéricas como 0", () => {
    const tsv = [HEADER, "APPLE\tUS\tSKU1\tD\tT\t1.0\t1\tn/a"].join("\n");
    expect(parseAppleSalesTsv(tsv)[0].units).toBe(0);
  });
});

describe("parseInstallsCsv (estatísticas do Google Play)", () => {
  it("extrai instalações diárias do overview mensal", () => {
    const csv = [
      "Date,Package Name,Daily Device Installs,Daily Device Uninstalls",
      "2026-07-01,pt.piquet.app,42,3",
      "2026-07-02,pt.piquet.app,55,1",
    ].join("\n");
    expect(parseInstallsCsv(csv)).toEqual([
      { date: "2026-07-01", installs: 42 },
      { date: "2026-07-02", installs: 55 },
    ]);
  });

  it("ignora linhas com datas inválidas e aceita cabeçalhos com maiúsculas variadas", () => {
    const csv = [
      "date,package name,DAILY DEVICE INSTALLS",
      "2026-07-01,pt.piquet.app,10",
      "total,,999",
    ].join("\n");
    const rows = parseInstallsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].installs).toBe(10);
  });

  it("devolve [] sem coluna de installs", () => {
    expect(parseInstallsCsv("Date,Foo\n2026-07-01,1")).toEqual([]);
    expect(parseInstallsCsv("")).toEqual([]);
  });
});
