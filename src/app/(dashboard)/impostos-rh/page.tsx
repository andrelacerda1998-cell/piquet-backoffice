"use client";

import { useState } from "react";
import { RouteGuard, PermissionGate } from "@/components/layout/RouteGuard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { ChartCard, BarChartComponent, AreaChartComponent } from "@/components/charts/Charts";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import {
  getEmployees, getTeamDashboard, getTaxObligations, getTaxSummary,
  markTaxObligationPaid, simulateHiring, getBudgetComparison,
  computeEmployeeCost, deactivateEmployee,
  getTeamCostEvolution, getCostByDepartmentChart,
} from "@/services/employeesService";
import { buildMetricValue } from "@/lib/calculations";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
import type { Employee, TaxObligation, ContractType } from "@/types";
import { X, Plus, Calculator } from "lucide-react";

type Tab = "fiscal" | "colaboradores" | "simulador" | "orcamento";

export default function TaxHRPage() {
  const [tab, setTab] = useState<Tab>("fiscal");
  const [calendarView, setCalendarView] = useState<"lista" | "mensal">("lista");
  const [selectedEmployee, setSelectedEmployee] = useState<(Employee & { cost: ReturnType<typeof computeEmployeeCost> }) | null>(null);
  const [_showAddEmployee, setShowAddEmployee] = useState(false);
  const { page, setPage, pageSize, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);

  const { data: taxSummary } = useAsyncData(() => getTaxSummary(), []);
  const { data: obligations } = useAsyncData(() => getTaxObligations(), []);
  const { data: teamDashboard } = useAsyncData(() => getTeamDashboard(), []);
  const { data: employees, loading, refetch } = useAsyncData(
    () => getEmployees(page, pageSize, undefined, debouncedSearch),
    [page, pageSize, debouncedSearch]
  );
  const { data: budget } = useAsyncData(() => getBudgetComparison(), []);
  const { data: teamCostEvolution } = useAsyncData(() => getTeamCostEvolution(), []);
  const { data: costByDept } = useAsyncData(() => getCostByDepartmentChart(), []);

  const [simInput, setSimInput] = useState({
    name: "Novo Full Stack Developer",
    jobTitle: "Full Stack Developer",
    department: "Tecnologia",
    grossMonthlySalary: 3200,
    contractType: "sem_termo" as ContractType,
    expectedStartDate: new Date().toISOString().slice(0, 10),
    annualSalaryPayments: 14,
    employerSocialSecurityRate: 0.2375,
    mealAllowanceMonthly: 0,
    workersCompensationInsuranceMonthly: 25,
    healthInsuranceMonthly: 45,
    equipmentAnnualCost: 1500,
    softwareAnnualCost: 600,
    trainingAnnualCost: 1000,
    recruitmentCost: 3000,
    annualBonus: 0,
    otherMonthlyCosts: 0,
  });
  const [simResult, setSimResult] = useState<Awaited<ReturnType<typeof simulateHiring>> | null>(null);

  const handleMarkPaid = async (id: string) => {
    await markTaxObligationPaid(id, new Date().toISOString());
    refetch();
  };

  const handleSimulate = async () => {
    const result = await simulateHiring(simInput);
    setSimResult(result);
  };

  const taxColumns: Column<TaxObligation>[] = [
    { key: "name", label: "Obrigação" },
    { key: "category", label: "Categoria", render: (r) => r.category.replace(/_/g, " ") },
    { key: "referencePeriod", label: "Período" },
    { key: "amountEstimated", label: "Estimado", render: (r) => formatCurrency(r.amountEstimated) },
    { key: "amountConfirmed", label: "Confirmado", render: (r) => r.amountConfirmed ? formatCurrency(r.amountConfirmed) : "—" },
    { key: "dueDate", label: "Data-limite", render: (r) => formatDate(r.dueDate) },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status} label={r.status.replace(/_/g, " ")} /> },
    { key: "actions", label: "Ações", render: (r) => r.status !== "pago" ? (
      <PermissionGate permission="mark_taxes_paid">
        <button onClick={() => handleMarkPaid(r.id)} className="text-xs text-piquet-600 hover:underline">Marcar pago</button>
      </PermissionGate>
    ) : "✓" },
  ];

  const empColumns: Column<Employee & { cost: ReturnType<typeof computeEmployeeCost> }>[] = [
    { key: "fullName", label: "Nome" },
    { key: "jobTitle", label: "Cargo" },
    { key: "department", label: "Departamento" },
    { key: "contractType", label: "Contrato", render: (r) => r.contractType.replace(/_/g, " ") },
    { key: "employmentStatus", label: "Estado", render: (r) => <StatusBadge status={r.employmentStatus} /> },
    { key: "grossMonthlySalary", label: "Salário bruto", render: (r) => (
      <PermissionGate permission="view_salaries" fallback="***">
        {formatCurrency(r.grossMonthlySalary)}
      </PermissionGate>
    )},
    { key: "cost", label: "Custo mensal", render: (r) => (
      <PermissionGate permission="view_individual_costs" fallback="***">
        {formatCurrency(r.cost.averageMonthlyCost)}
      </PermissionGate>
    )},
    { key: "costAnnual", label: "Custo anual", render: (r) => (
      <PermissionGate permission="view_individual_costs" fallback="***">
        {formatCurrency(r.cost.totalAnnualCost)}
      </PermissionGate>
    )},
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: "fiscal", label: "Fiscal" },
    { id: "colaboradores", label: "Colaboradores" },
    { id: "simulador", label: "Simulador" },
    { id: "orcamento", label: "Orçamento" },
  ];

  return (
    <RouteGuard route="/impostos-rh">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Impostos e Recursos Humanos</h1>
          <p className="text-text-secondary mt-1">Gestão fiscal e equipa interna — valores estimados</p>
        </div>

        <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />

        {tab === "fiscal" && (
          <>
            {taxSummary && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard title="Previstos (mês)" metric={buildMetricValue(taxSummary.estimatedThisMonth, taxSummary.estimatedThisMonth * 0.95, true)} format="currency" />
                <MetricCard title="Pagos (mês)" metric={buildMetricValue(taxSummary.paidThisMonth, taxSummary.paidThisMonth * 0.9)} format="currency" />
                <MetricCard title="Pendentes" metric={buildMetricValue(taxSummary.pending, taxSummary.pending * 1.05, true)} format="currency" />
                <MetricCard title="IVA estimado" metric={buildMetricValue(taxSummary.ivaEstimado, taxSummary.ivaEstimado * 0.95, true)} format="currency" />
                <MetricCard title="Seg. Social est." metric={buildMetricValue(taxSummary.estimatedSocialSecurity, taxSummary.estimatedSocialSecurity * 0.98, true)} format="currency" />
                <MetricCard title="Vencidas" metric={buildMetricValue(taxSummary.overdueCount, 0, true)} />
              </div>
            )}

            <div className="card p-4">
              <p className="text-sm font-medium mb-2">{taxSummary?.ivaLabel ?? "IVA"}</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-text-secondary">Liquidado:</span> {formatCurrency(taxSummary?.ivaLiquidado ?? 0)}</div>
                <div><span className="text-text-secondary">Dedutível:</span> {formatCurrency(taxSummary?.ivaDedutivel ?? 0)}</div>
                <div><span className="text-text-secondary">Estimado:</span> {formatCurrency(taxSummary?.ivaEstimado ?? 0)}</div>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <button onClick={() => setCalendarView("lista")} className={`text-sm px-3 py-1 rounded ${calendarView === "lista" ? "bg-piquet" : "bg-surface-muted"}`}>Lista</button>
              <button onClick={() => setCalendarView("mensal")} className={`text-sm px-3 py-1 rounded ${calendarView === "mensal" ? "bg-piquet" : "bg-surface-muted"}`}>Mensal</button>
            </div>

            <DataTable columns={taxColumns} data={obligations ?? []} keyField="id" />
          </>
        )}

        {tab === "colaboradores" && (
          <>
            {teamDashboard && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard title="Total colaboradores" metric={buildMetricValue(teamDashboard.totalEmployees, teamDashboard.totalEmployees)} />
                <MetricCard title="Ativos" metric={buildMetricValue(teamDashboard.activeEmployees, teamDashboard.activeEmployees - 1)} />
                <PermissionGate permission="view_aggregated_costs">
                  <MetricCard title="Custo mensal equipa" metric={buildMetricValue(teamDashboard.monthlyTeamCost, teamDashboard.monthlyTeamCost * 0.98, true)} format="currency" />
                  <MetricCard title="Custo médio/colaborador" metric={buildMetricValue(teamDashboard.averageCostPerEmployee, teamDashboard.averageCostPerEmployee * 0.98, true)} format="currency" />
                </PermissionGate>
                <MetricCard title="Novas contratações" metric={buildMetricValue(teamDashboard.newHires, 1)} />
                <MetricCard title="Saídas" metric={buildMetricValue(teamDashboard.departures, 0, true)} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Evolução custo mensal">
                <AreaChartComponent data={(teamCostEvolution ?? []).map((d) => ({ name: d.date, value: d.value }))} currency />
              </ChartCard>
              <ChartCard title="Custo por departamento">
                <BarChartComponent data={costByDept ?? []} currency />
              </ChartCard>
            </div>

            <div className="flex justify-between items-center">
              <SearchInput value={search} onChange={setSearch} className="max-w-sm" placeholder="Pesquisar colaboradores..." />
              <PermissionGate permission="manage_employees">
                <button onClick={() => setShowAddEmployee(true)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> Adicionar</button>
              </PermissionGate>
            </div>

            <DataTable columns={empColumns} data={employees?.data ?? []} keyField="id" onRowClick={setSelectedEmployee} loading={loading} />
            {employees && <Pagination page={page} totalPages={employees.totalPages} total={employees.total} pageSize={pageSize} onPageChange={setPage} />}
          </>
        )}

        {tab === "simulador" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Calculator className="h-5 w-5" /> Simular contratação</h3>
              <SimField label="Nome do cenário" value={simInput.name} onChange={(v) => setSimInput({ ...simInput, name: v })} />
              <SimField label="Cargo" value={simInput.jobTitle} onChange={(v) => setSimInput({ ...simInput, jobTitle: v })} />
              <SimField label="Departamento" value={simInput.department} onChange={(v) => setSimInput({ ...simInput, department: v })} />
              <SimField label="Salário bruto mensal (€)" value={String(simInput.grossMonthlySalary)} onChange={(v) => setSimInput({ ...simInput, grossMonthlySalary: Number(v) })} type="number" />
              <SimField label="Remunerações anuais" value={String(simInput.annualSalaryPayments)} onChange={(v) => setSimInput({ ...simInput, annualSalaryPayments: Number(v) })} type="number" />
              <SimField label="Taxa SS empresa (%)" value={String(simInput.employerSocialSecurityRate * 100)} onChange={(v) => setSimInput({ ...simInput, employerSocialSecurityRate: Number(v) / 100 })} type="number" />
              <SimField label="Recrutamento (€)" value={String(simInput.recruitmentCost)} onChange={(v) => setSimInput({ ...simInput, recruitmentCost: Number(v) })} type="number" />
              <button onClick={handleSimulate} className="btn-primary w-full">Calcular impacto</button>
            </div>
            {simResult && (
              <div className="card p-6 space-y-3">
                <h3 className="font-semibold">Resultado — {simResult.name}</h3>
                <ResultRow label="Custo mensal" value={formatCurrency(simResult.monthlyCost)} />
                <ResultRow label="Custo anual" value={formatCurrency(simResult.annualCost)} />
                <ResultRow label="Custo 1.º ano (c/ recrutamento)" value={formatCurrency(simResult.firstYearCost)} />
                <ResultRow label="Impacto burn rate" value={formatCurrency(simResult.impactOnBurnRate)} />
                <ResultRow label="Impacto runway" value={simResult.impactOnRunway ? `${simResult.impactOnRunway.toFixed(1)} meses` : "N/A"} />
              </div>
            )}
          </div>
        )}

        {tab === "orcamento" && (
          <div>
            <h3 className="font-semibold mb-4">Orçamento vs Real — pessoal e fiscal</h3>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-muted/50">
                    <th className="px-4 py-3 text-left">Categoria</th>
                    <th className="px-4 py-3 text-right">Previsto</th>
                    <th className="px-4 py-3 text-right">Real</th>
                    <th className="px-4 py-3 text-right">Desvio €</th>
                    <th className="px-4 py-3 text-right">Desvio %</th>
                  </tr>
                </thead>
                <tbody>
                  {(budget ?? []).map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{b.name}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(b.planned)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(b.actual)}</td>
                      <td className={`px-4 py-3 text-right ${b.variance > 0 ? "text-danger" : "text-success"}`}>{formatCurrency(b.variance)}</td>
                      <td className={`px-4 py-3 text-right ${b.variancePercent > 0 ? "text-danger" : "text-success"}`}>{formatPercent(b.variancePercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedEmployee && (
          <EmployeeDrawer employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onDeactivate={async () => { await deactivateEmployee(selectedEmployee.id); setSelectedEmployee(null); refetch(); }} />
        )}
      </div>
    </RouteGuard>
  );
}

function SimField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-text-secondary mb-1 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input-field" />
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-surface-border">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function EmployeeDrawer({ employee, onClose, onDeactivate }: {
  employee: Employee & { cost: ReturnType<typeof computeEmployeeCost> };
  onClose: () => void;
  onDeactivate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-6">
          <h2 className="text-lg font-bold">{employee.fullName}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <ResultRow label="Cargo" value={employee.jobTitle} />
          <ResultRow label="Departamento" value={employee.department} />
          <ResultRow label="Contrato" value={employee.contractType.replace(/_/g, " ")} />
          <ResultRow label="Entrada" value={formatDate(employee.startDate)} />
          <PermissionGate permission="view_salaries">
            <ResultRow label="Salário bruto mensal" value={formatCurrency(employee.grossMonthlySalary)} />
            <ResultRow label="Salário bruto anual" value={formatCurrency(employee.cost.grossAnnualSalary)} />
          </PermissionGate>
          <PermissionGate permission="view_individual_costs">
            <ResultRow label="Encargos sociais (anual)" value={formatCurrency(employee.cost.employerSocialSecurity)} />
            <ResultRow label="Subsídio alimentação (anual)" value={formatCurrency(employee.cost.mealAllowance)} />
            <ResultRow label="Seguros (anual)" value={formatCurrency(employee.cost.insurance)} />
            <ResultRow label="Equipamento (anual)" value={formatCurrency(employee.cost.equipment)} />
            <ResultRow label="Software (anual)" value={formatCurrency(employee.cost.software)} />
            <ResultRow label="Custo mensal médio" value={formatCurrency(employee.cost.averageMonthlyCost)} />
            <ResultRow label="Custo anual total" value={formatCurrency(employee.cost.totalAnnualCost)} />
          </PermissionGate>
        </div>
        <PermissionGate permission="manage_employees">
          <button onClick={onDeactivate} className="mt-6 btn-secondary text-sm text-danger w-full">Desativar colaborador</button>
        </PermissionGate>
      </div>
    </div>
  );
}
