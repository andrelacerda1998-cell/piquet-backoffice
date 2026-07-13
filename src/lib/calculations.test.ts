import { describe, it, expect } from "vitest";
import {
  calculatePiquetRevenue,
  calculatePiquetRevenueWithoutVat,
  calculateVatFromRevenue,
  calculateEstimatedVat,
  calculateEmployeeAnnualCost,
  calculateContractorCost,
  calculateBurnRate,
  calculateRunway,
  calculateCPL,
  calculateCAC,
  calculateROAS,
  calculateConversionRate,
  calculateChangePercent,
  getVatLabel,
} from "@/lib/calculations";

describe("Financial calculations", () => {
  it("calculates Piquet revenue correctly", () => {
    expect(calculatePiquetRevenue(100, 65)).toBe(35);
    expect(calculatePiquetRevenue(50, 60)).toBe(0);
  });

  it("calculates revenue without VAT", () => {
    const revenue = 123;
    expect(calculatePiquetRevenueWithoutVat(revenue, 0.23)).toBeCloseTo(100, 0);
  });

  it("calculates VAT from revenue", () => {
    const revenue = 123;
    const withoutVat = calculatePiquetRevenueWithoutVat(revenue, 0.23);
    expect(calculateVatFromRevenue(revenue, 0.23)).toBeCloseTo(revenue - withoutVat, 1);
  });

  it("calculates estimated VAT", () => {
    expect(calculateEstimatedVat(10000, 3000)).toBe(7000);
    expect(calculateEstimatedVat(3000, 5000)).toBe(-2000);
  });

  it("returns correct VAT label", () => {
    expect(getVatLabel(100)).toBe("IVA estimado a pagar");
    expect(getVatLabel(-100)).toBe("IVA estimado a recuperar ou reportar");
    expect(getVatLabel(0)).toBe("IVA equilibrado");
  });
});

describe("Employee cost calculations", () => {
  const baseInput = {
    grossMonthlySalary: 3000,
    annualSalaryPayments: 14,
    mealAllowanceMonthly: 6,
    mealAllowanceMonths: 11,
    fixedAllowancesMonthly: 0,
    variableCompensationMonthly: 100,
    annualBonus: 2000,
    employerSocialSecurityRate: 0.2375,
    workersCompensationInsuranceMonthly: 25,
    healthInsuranceMonthly: 45,
    equipmentAnnualCost: 1000,
    softwareAnnualCost: 500,
    trainingAnnualCost: 800,
    recruitmentCost: 0,
    otherMonthlyCosts: 50,
    otherAnnualCosts: 200,
  };

  it("calculates employee annual cost", () => {
    const result = calculateEmployeeAnnualCost(baseInput);
    expect(result.grossAnnualSalary).toBe(42000);
    expect(result.employerSocialSecurityAnnual).toBeCloseTo(9975, 0);
    expect(result.totalEmployeeAnnualCost).toBeGreaterThan(result.grossAnnualSalary);
    expect(result.averageEmployeeMonthlyCost).toBeCloseTo(result.totalEmployeeAnnualCost / 12, 0);
  });

  it("calculates contractor cost differently", () => {
    const result = calculateContractorCost({
      monthlyContractValue: 1800,
      vatRate: 0.23,
      withholdingRate: 0.25,
      additionalExpenses: 0,
      softwareAnnual: 500,
      equipmentAnnual: 0,
      bonuses: 0,
    });
    expect(result.monthlyCost).toBeGreaterThan(1700);
    expect(result.withholding).toBeGreaterThan(0);
    expect(result.annualCost).toBeGreaterThan(result.monthlyCost * 12);
  });
});

describe("Business metrics", () => {
  it("calculates burn rate", () => {
    expect(calculateBurnRate(50000, 70000)).toBe(-20000);
    expect(calculateBurnRate(80000, 50000)).toBe(30000);
  });

  it("calculates runway only when burn rate is positive", () => {
    expect(calculateRunway(150000, 30000)).toBe(5);
    expect(calculateRunway(150000, -10000)).toBeNull();
    expect(calculateRunway(150000, 0)).toBeNull();
  });

  it("calculates marketing metrics", () => {
    expect(calculateCPL(1000, 50)).toBe(20);
    expect(calculateCPL(1000, 0)).toBe(0);
    expect(calculateCAC(5000, 25)).toBe(200);
    expect(calculateROAS(15000, 5000)).toBe(3);
    expect(calculateConversionRate(68, 100)).toBe(68);
  });

  it("calculates change percent", () => {
    expect(calculateChangePercent(110, 100)).toBe(10);
    expect(calculateChangePercent(0, 0)).toBe(0);
    expect(calculateChangePercent(50, 0)).toBe(100);
  });
});

describe("Formatters", () => {
  it("formats currency in pt-PT", async () => {
    const { formatCurrency } = await import("@/lib/formatters");
    const formatted = formatCurrency(1234.56);
    expect(formatted).toContain("1");
    expect(formatted).toContain("234,56");
    expect(formatted).toContain("€");
  });

  it("formats dates in pt-PT", async () => {
    const { formatDate } = await import("@/lib/formatters");
    expect(formatDate("2025-06-15")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe("Permissions", () => {
  it("cto has all permissions", async () => {
    const { hasPermission } = await import("@/lib/permissions");
    expect(hasPermission("cto", "view_salaries")).toBe(true);
    expect(hasPermission("cto", "manage_taxes")).toBe(true);
  });

  it("ceo also has full access (só liderança tem login)", async () => {
    const { hasPermission } = await import("@/lib/permissions");
    expect(hasPermission("ceo", "manage_settings")).toBe(true);
    expect(hasPermission("ceo", "destructive_actions")).toBe(true);
    expect(hasPermission("ceo", "manage_employees")).toBe(true);
  });
});

describe("Filters", () => {
  it("counts active filters", async () => {
    const { getActiveFilterCount, DEFAULT_FILTER } = await import("@/lib/filters");
    expect(getActiveFilterCount(DEFAULT_FILTER)).toBe(0);
    expect(getActiveFilterCount({ ...DEFAULT_FILTER, city: "Lisboa" })).toBe(1);
    expect(getActiveFilterCount({ ...DEFAULT_FILTER, city: "Lisboa", categoryId: "cat_1", period: "hoje" })).toBe(3);
  });
});

describe("Mock data consistency", () => {
  it("has consistent revenue formula in services", async () => {
    const { mockData } = await import("@/mocks/data");
    const sample = mockData.services.slice(0, 100);
    sample.forEach((s) => {
      expect(s.piquetRevenue).toBeCloseTo(s.totalCustomerValue - s.technicianValue, 1);
    });
  });

  it("has expected demo data counts", async () => {
    const { mockData } = await import("@/mocks/data");
    expect(mockData.customers.length).toBe(752);
    expect(mockData.technicians.length).toBe(382);
    expect(mockData.isDemo).toBe(true);
  });

  it("active technicians are subset of approved", async () => {
    const { mockData } = await import("@/mocks/data");
    const active = mockData.technicians.filter((t) => t.status === "ativo").length;
    const approved = mockData.technicians.filter((t) =>
      ["aprovado", "disponivel", "ativo"].includes(t.status)
    ).length;
    expect(active).toBeLessThanOrEqual(approved);
  });
});
