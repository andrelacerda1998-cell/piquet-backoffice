"use client";

import { useState } from "react";
import { RouteGuard, PermissionGate } from "@/components/layout/RouteGuard";
import { StatGroup, Stat } from "@/components/ui/Stats";
import { Painel } from "@/components/ui/Painel";
import { DataTable, Pagination, SearchInput, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { ChartCard, BarChartComponent } from "@/components/charts/Charts";
import { useAsyncData, usePagination, useDebouncedValue } from "@/hooks/useDashboard";
import {
  getEmployees, getTeamDashboard, getTaxObligations, getTaxSummary,
  markTaxObligationPaid, simulateHiring,
  computeEmployeeCost, deactivateEmployee, deleteEmployee, createEmployee, updateEmployee, effectiveMonthlyCost, getVatSummary,
  getCostByDepartmentChart,
} from "@/services/employeesService";
import { Modal, Field } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/stores";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Employee, TaxObligation, ContractType } from "@/types";
import { X, Plus, Calculator } from "lucide-react";
import { SectionHeader } from "@/components/ui/PageHeader";
import { DemoBadge } from "@/components/ui/DemoBadge";

type Tab = "fiscal" | "colaboradores" | "simulador";

const CONTRACT_LABELS: Record<ContractType, string> = {
  sem_termo: "Sem termo",
  a_termo: "A termo",
  prestacao_servicos: "Prestação de serviços",
  estagio: "Estágio",
  administrador: "Administrador",
  part_time: "Part-time",
  outro: "Outro",
};

const EMPTY_EMP_FORM = {
  fullName: "", jobTitle: "", department: "",
  contractType: "sem_termo" as ContractType,
  grossMonthlySalary: 0, annualSalaryPayments: 14, mealAllowanceMonthly: 0,
  monthlyCompanyCost: 0, // 0 = não definido → cálculo automático
  startDate: "", notes: "",
};

export default function TaxHRPage() {
  const [tab, setTab] = useState<Tab>("fiscal");
  const [selectedEmployee, setSelectedEmployee] = useState<(Employee & { cost: ReturnType<typeof computeEmployeeCost> }) | null>(null);
  const [empModal, setEmpModal] = useState<{ open: boolean; editing: Employee | null }>({ open: false, editing: null });
  const [empForm, setEmpForm] = useState(EMPTY_EMP_FORM);
  const openEmpModal = (emp: Employee | null) => {
    setEmpForm(emp
      ? {
          fullName: emp.fullName, jobTitle: emp.jobTitle, department: emp.department,
          contractType: emp.contractType,
          grossMonthlySalary: emp.grossMonthlySalary, annualSalaryPayments: emp.annualSalaryPayments,
          mealAllowanceMonthly: emp.mealAllowanceMonthly,
          monthlyCompanyCost: emp.monthlyCompanyCost && emp.monthlyCompanyCost > 0 ? emp.monthlyCompanyCost : 0,
          startDate: emp.startDate ? emp.startDate.slice(0, 10) : "",
          notes: emp.notes ?? "",
        }
      : EMPTY_EMP_FORM);
    setEmpModal({ open: true, editing: emp });
  };
  const { page, setPage, pageSize, search, setSearch } = usePagination();
  const debouncedSearch = useDebouncedValue(search);

  const { data: taxSummary } = useAsyncData(() => getTaxSummary(), []);
  // IVA a entregar/recuperar — calculado da comissão real e das faturas de custo.
  const { data: vat } = useAsyncData(() => getVatSummary(), []);
  const { data: obligations } = useAsyncData(() => getTaxObligations(), []);
  const { data: teamDashboard, refetch: refetchDashboard } = useAsyncData(() => getTeamDashboard(), []);
  const { data: employees, loading, refetch } = useAsyncData(
    () => getEmployees(page, pageSize, undefined, debouncedSearch),
    [page, pageSize, debouncedSearch]
  );

  // Sair da empresa (desativar, guarda o histórico) vs. registo errado (eliminar).
  const [empToDeactivate, setEmpToDeactivate] = useState<Employee | null>(null);
  const [empToDelete, setEmpToDelete] = useState<Employee | null>(null);
  const doDeactivate = async (emp: Employee) => {
    try {
      await deactivateEmployee(emp.id);
      toast(`${emp.fullName} desativado — o histórico de custos mantém-se.`);
      refetch(); refetchDashboard();
    } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível desativar.", "error"); }
  };
  const doDelete = async (emp: Employee) => {
    try {
      await deleteEmployee(emp.id);
      toast(`${emp.fullName} eliminado.`);
      refetch(); refetchDashboard();
    } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível eliminar.", "error"); }
  };

  const saveEmployee = async () => {
    if (!empForm.fullName.trim() || !(empForm.grossMonthlySalary > 0) || !empForm.startDate) {
      toast("Indica o nome, o salário bruto e o início do contrato.", "error");
      return;
    }
    const manualCost = Number(empForm.monthlyCompanyCost) > 0 ? Number(empForm.monthlyCompanyCost) : null;
    try {
      if (empModal.editing) {
        await updateEmployee(empModal.editing.id, {
          fullName: empForm.fullName.trim(),
          jobTitle: empForm.jobTitle.trim(),
          department: empForm.department.trim(),
          contractType: empForm.contractType,
          grossMonthlySalary: Number(empForm.grossMonthlySalary),
          annualSalaryPayments: Number(empForm.annualSalaryPayments) || 14,
          mealAllowanceMonthly: Number(empForm.mealAllowanceMonthly) || 0,
          monthlyCompanyCost: manualCost, // null limpa o manual → volta ao automático
          startDate: empForm.startDate,
          notes: empForm.notes.trim(),
        });
        toast("Colaborador atualizado.");
      } else {
        await createEmployee({
          fullName: empForm.fullName.trim(),
          jobTitle: empForm.jobTitle.trim() || undefined,
          department: empForm.department.trim() || undefined,
          contractType: empForm.contractType,
          grossMonthlySalary: Number(empForm.grossMonthlySalary),
          annualSalaryPayments: Number(empForm.annualSalaryPayments) || 14,
          mealAllowanceMonthly: Number(empForm.mealAllowanceMonthly) || 0,
          monthlyCompanyCost: manualCost ?? undefined,
          startDate: empForm.startDate,
          notes: empForm.notes.trim() || undefined,
        });
        toast("Colaborador registado.");
      }
      setEmpModal({ open: false, editing: null });
      setEmpForm(EMPTY_EMP_FORM);
      refetch();
      refetchDashboard();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível guardar.", "error");
    }
  };
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
  const [simResult, setSimResult] = useState<ReturnType<typeof simulateHiring> | null>(null);

  const handleMarkPaid = async (id: string) => {
    await markTaxObligationPaid(id, new Date().toISOString());
    refetch();
  };

  const handleSimulate = () => setSimResult(simulateHiring(simInput));

  const taxColumns: Column<TaxObligation>[] = [
    { key: "name", label: "Obrigação" },
    { key: "category", label: "Categoria", render: (r) => r.category.replace(/_/g, " ") },
    { key: "referencePeriod", label: "Período" },
    { key: "amountEstimated", label: "Estimado", className: "text-right", render: (r) => <span className="tabular-nums">{formatCurrency(r.amountEstimated)}</span> },
    { key: "amountConfirmed", label: "Confirmado", className: "text-right", render: (r) => r.amountConfirmed ? <span className="tabular-nums">{formatCurrency(r.amountConfirmed)}</span> : "—" },
    { key: "dueDate", label: "Data-limite", render: (r) => formatDate(r.dueDate) },
    { key: "status", label: "Estado", render: (r) => <StatusBadge status={r.status} label={r.status.replace(/_/g, " ")} /> },
    { key: "actions", label: "", className: "text-right", render: (r) => r.status !== "pago" ? (
      <PermissionGate permission="mark_taxes_paid">
        <button onClick={() => handleMarkPaid(r.id)} className="btn-ghost text-xs px-2 py-1">Marcar pago</button>
      </PermissionGate>
    ) : <span className="text-success">✓</span> },
  ];

  const empColumns: Column<Employee & { cost: ReturnType<typeof computeEmployeeCost> }>[] = [
    { key: "fullName", label: "Nome" },
    { key: "jobTitle", label: "Cargo" },
    { key: "department", label: "Departamento" },
    { key: "contractType", label: "Contrato", render: (r) => CONTRACT_LABELS[r.contractType] ?? r.contractType.replace(/_/g, " ") },
    { key: "startDate", label: "Início do contrato", render: (r) => r.startDate ? formatDate(r.startDate) : "—" },
    { key: "employmentStatus", label: "Estado", render: (r) => <StatusBadge status={r.employmentStatus} /> },
    { key: "grossMonthlySalary", label: "Salário bruto", render: (r) => (
      <PermissionGate permission="view_salaries" fallback="***">
        {formatCurrency(r.grossMonthlySalary)}
      </PermissionGate>
    )},
    { key: "cost", label: "Custo mensal", render: (r) => (
      <PermissionGate permission="view_individual_costs" fallback="***">
        <span className="inline-flex items-center gap-1.5">
          {formatCurrency(effectiveMonthlyCost(r, r.cost))}
          {r.monthlyCompanyCost != null && r.monthlyCompanyCost > 0 && (
            <span title="Custo definido à mão — substitui o cálculo automático" className="text-[11px] px-1 py-0.5 rounded bg-surface-subtle text-text-muted">manual</span>
          )}
        </span>
      </PermissionGate>
    )},
    { key: "costAnnual", label: "Custo anual", render: (r) => (
      <PermissionGate permission="view_individual_costs" fallback="***">
        {formatCurrency(r.monthlyCompanyCost != null && r.monthlyCompanyCost > 0 ? r.monthlyCompanyCost * 12 : r.cost.totalAnnualCost)}
      </PermissionGate>
    )},
    { key: "acoes", label: "", render: (r) => (
      <PermissionGate permission="manage_employees">
        <div className="flex items-center justify-end gap-0.5 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100">
          <button onClick={(e) => { e.stopPropagation(); openEmpModal(r); }} className="btn-ghost text-xs px-2 py-1">Editar</button>
          {/* Saiu da empresa → desativar (mantém o histórico de custos). */}
          {r.employmentStatus === "ativo" && (
            <button onClick={(e) => { e.stopPropagation(); setEmpToDeactivate(r); }} className="btn-ghost text-xs px-2 py-1 text-warning hover:text-warning">Desativar</button>
          )}
          {/* Registo errado → eliminar de vez (só depois de escrever o nome; quem saiu, desativa-se). */}
          <button onClick={(e) => { e.stopPropagation(); setEmpToDelete(r); }} className="btn-ghost text-xs px-2 py-1 hover:text-danger">Eliminar</button>
        </div>
      </PermissionGate>
    )},
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: "fiscal", label: "Fiscal" },
    { id: "colaboradores", label: "Colaboradores" },
    { id: "simulador", label: "Simulador" },
  ];

  return (
    <RouteGuard route="/impostos-rh">
      <div className="space-y-6">
        {/* Vive dentro do Financeiro › Resultado, numa secção que já tem o
            título: aqui fica só o que distingue isto do resto. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs variant="pill" tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />
          <span className="inline-flex items-center gap-2 text-xs text-text-muted">
            Valores estimados <DemoBadge endpoint="/tax/obligations" />
          </span>
        </div>

        {tab === "fiscal" && (
          <>
            {taxSummary && (
              <StatGroup cols={6}>
                <Stat label="Previstos (mês)" value={formatCurrency(taxSummary.estimatedThisMonth)} />
                <Stat label="Pagos (mês)" value={formatCurrency(taxSummary.paidThisMonth)} />
                <Stat label="Pendentes" value={formatCurrency(taxSummary.pending)} />
                {/* IVA REAL do trimestre (comissão cobrada − faturas de custo),
                    não o valor fixo que vinha do resumo fiscal. */}
                <Stat label={vat?.trimestre.aPagar === false ? "IVA a recuperar (trim.)" : "IVA a entregar (trim.)"}
                  value={formatCurrency(Math.abs(vat?.trimestre.aEntregar ?? 0))} tone={vat?.trimestre.aPagar === false ? "bom" : undefined} />
                {/* REAL: TSU da entidade derivada da folha atual dos colaboradores (não do seed fiscal). */}
                <Stat label="TSU equipa (mensal)" value={formatCurrency(teamDashboard?.socialSecurityMonthly ?? 0)} />
                <Stat label="Vencidas" value={taxSummary.overdueCount} tone={taxSummary.overdueCount > 0 ? "mau" : undefined} />
              </StatGroup>
            )}

            {/* IVA calculado dos dados reais: comissão cobrada (liquidado) e
                faturas de custo registadas (dedutível). */}
            {vat && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[vat.trimestre, vat.mes].map((p, i) => (
                  <Painel key={i} titulo={p.label.charAt(0).toUpperCase() + p.label.slice(1)} aside={i === 0 ? "período de entrega" : "no mês"}>
                    <p className="text-[13px] text-text-secondary">{p.aPagar ? "IVA a entregar ao Estado" : "IVA a recuperar / reportar"}</p>
                    <p className={cn("text-[26px] leading-8 font-semibold tracking-tight tabular-nums mt-0.5", p.aPagar ? "text-text-primary" : "text-success")}>
                      {formatCurrency(Math.abs(p.aEntregar))}
                    </p>
                    <dl className="mt-4 space-y-1.5 text-[13px]">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-text-secondary">IVA liquidado <span className="text-text-muted">(na comissão de {formatCurrency(p.comissao)})</span></dt>
                        <dd className="tabular-nums font-medium">{formatCurrency(p.liquidado)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-text-secondary">IVA dedutível <span className="text-text-muted">({p.faturasContadas} fatura{p.faturasContadas === 1 ? "" : "s"} de custo)</span></dt>
                        <dd className="tabular-nums font-medium">− {formatCurrency(p.dedutivel)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-surface-border pt-1.5">
                        <dt className="font-medium text-text-primary">{p.aPagar ? "A entregar" : "A recuperar"}</dt>
                        <dd className={cn("tabular-nums font-semibold", p.aPagar ? "text-text-primary" : "text-success")}>{formatCurrency(Math.abs(p.aEntregar))}</dd>
                      </div>
                    </dl>
                  </Painel>
                ))}
              </div>
            )}
            <p className="text-xs text-text-muted">
              Calculado a {Math.round((vat?.taxaIva ?? 0.23) * 100)}%: o IVA liquidado sai da comissão efetivamente cobrada;
              o dedutível é uma <b className="font-medium text-text-secondary">estimativa</b> sobre as faturas de custo registadas — despesas isentas
              (salários, seguros, alguns serviços) não têm IVA a deduzir, por isso confirma com a contabilidade antes de entregar.
            </p>

            <section>
              <SectionHeader title="Obrigações fiscais" description="O que há a entregar ao Estado, com o prazo de cada uma." />
              <DataTable columns={taxColumns} data={obligations ?? []} keyField="id" />
            </section>
          </>
        )}

        {tab === "colaboradores" && (
          <>
            {teamDashboard && (
              <StatGroup cols={6}>
                <Stat label="Colaboradores" value={teamDashboard.totalEmployees} />
                <Stat label="Ativos" value={teamDashboard.activeEmployees} />
                <PermissionGate permission="view_aggregated_costs">
                  <Stat label="Custo mensal da equipa" value={formatCurrency(teamDashboard.monthlyTeamCost)} />
                  <Stat label="Custo médio por pessoa" value={formatCurrency(teamDashboard.averageCostPerEmployee)} />
                </PermissionGate>
                <Stat label="Novas contratações" value={teamDashboard.newHires} />
                <Stat label="Saídas" value={teamDashboard.departures} />
              </StatGroup>
            )}

            {/*
              Saiu a "Evolução custo mensal": não havia rota, e a curva era o
              custo de hoje multiplicado por 0,95, 0,96, 0,97… — uma subida
              desenhada à mão. Sem histórico de salários não há evolução.
            */}
            <ChartCard title="Custo por departamento">
              <BarChartComponent data={costByDept ?? []} currency />
            </ChartCard>

            <section>
              <SectionHeader
                title="Colaboradores"
                aside={
                  <PermissionGate permission="manage_employees">
                    <button onClick={() => openEmpModal(null)} className="btn-secondary text-sm"><Plus className="h-4 w-4" /> Adicionar</button>
                  </PermissionGate>
                }
              />
              <DataTable columns={empColumns} data={employees?.data ?? []} keyField="id" onRowClick={setSelectedEmployee} loading={loading}
                toolbar={<SearchInput value={search} onChange={setSearch} className="w-full sm:w-64" placeholder="Pesquisar colaboradores..." />}
                emptyMessage="Ainda não há colaboradores registados. Adiciona-os aqui para o custo mensal da equipa entrar no Planeamento e no resultado operacional." />
              {employees && <Pagination page={page} totalPages={employees.totalPages} total={employees.total} pageSize={pageSize} onPageChange={setPage} />}
            </section>
          </>
        )}

        {tab === "simulador" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Painel titulo="Simular contratação" icon={Calculator} corpo="p-4 space-y-3">
              <SimField label="Nome do cenário" value={simInput.name} onChange={(v) => setSimInput({ ...simInput, name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <SimField label="Cargo" value={simInput.jobTitle} onChange={(v) => setSimInput({ ...simInput, jobTitle: v })} />
                <SimField label="Departamento" value={simInput.department} onChange={(v) => setSimInput({ ...simInput, department: v })} />
                <SimField label="Salário bruto mensal (€)" value={String(simInput.grossMonthlySalary)} onChange={(v) => setSimInput({ ...simInput, grossMonthlySalary: Number(v) })} type="number" />
                <SimField label="Remunerações anuais" value={String(simInput.annualSalaryPayments)} onChange={(v) => setSimInput({ ...simInput, annualSalaryPayments: Number(v) })} type="number" />
                <SimField label="Taxa SS empresa (%)" value={String(simInput.employerSocialSecurityRate * 100)} onChange={(v) => setSimInput({ ...simInput, employerSocialSecurityRate: Number(v) / 100 })} type="number" />
                <SimField label="Recrutamento (€)" value={String(simInput.recruitmentCost)} onChange={(v) => setSimInput({ ...simInput, recruitmentCost: Number(v) })} type="number" />
              </div>
              <button onClick={handleSimulate} className="btn-primary w-full">Calcular impacto</button>
            </Painel>
            {simResult ? (
              <Painel titulo={`Resultado — ${simResult.name}`} corpo="px-4 py-1">
                <ResultRow label="Custo mensal" value={formatCurrency(simResult.monthlyCost)} />
                <ResultRow label="Custo anual" value={formatCurrency(simResult.annualCost)} />
                <ResultRow label="Custo 1.º ano (c/ recrutamento)" value={formatCurrency(simResult.firstYearCost)} />
              </Painel>
            ) : (
              <p className="card px-4 py-8 text-center text-sm text-text-muted">Preenche o cenário e carrega em &quot;Calcular impacto&quot;.</p>
            )}
          </div>
        )}

        {selectedEmployee && (
          <EmployeeDrawer
            employee={selectedEmployee}
            onClose={() => setSelectedEmployee(null)}
            onDeactivate={async () => { await deactivateEmployee(selectedEmployee.id); setSelectedEmployee(null); refetch(); refetchDashboard(); }}
            onEdit={() => { setSelectedEmployee(null); openEmpModal(selectedEmployee); }}
          />
        )}

        <Modal
          open={empModal.open}
          onClose={() => setEmpModal({ open: false, editing: null })}
          title={empModal.editing ? "Editar colaborador" : "Adicionar colaborador"}
          subtitle="Salário e início do contrato entram no planeamento mensal"
          footer={
            <>
              <button onClick={() => setEmpModal({ open: false, editing: null })} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={saveEmployee} className="btn-primary text-sm">{empModal.editing ? "Guardar" : "Adicionar"}</button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Nome completo">
              <input value={empForm.fullName} onChange={(e) => setEmpForm({ ...empForm, fullName: e.target.value })} placeholder="Ex.: Rodrigo Silva" className="input-field" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cargo">
                <input value={empForm.jobTitle} onChange={(e) => setEmpForm({ ...empForm, jobTitle: e.target.value })} placeholder="Ex.: Developer" className="input-field" />
              </Field>
              <Field label="Departamento">
                <input value={empForm.department} onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })} placeholder="Ex.: Tecnologia" className="input-field" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de contrato">
                <select value={empForm.contractType} onChange={(e) => setEmpForm({ ...empForm, contractType: e.target.value as ContractType })} className="input-field">
                  {Object.entries(CONTRACT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Início do contrato">
                <input type="date" value={empForm.startDate} onChange={(e) => setEmpForm({ ...empForm, startDate: e.target.value })} className="input-field" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Salário bruto (€/mês)">
                <input type="number" min={0} step="0.01" value={empForm.grossMonthlySalary} onChange={(e) => setEmpForm({ ...empForm, grossMonthlySalary: Number(e.target.value) })} className="input-field" />
              </Field>
              <Field label="Pagamentos/ano">
                <input type="number" min={12} max={14} value={empForm.annualSalaryPayments} onChange={(e) => setEmpForm({ ...empForm, annualSalaryPayments: Number(e.target.value) })} className="input-field" />
              </Field>
              <Field label="Sub. alimentação (€/mês)">
                <input type="number" min={0} step="0.01" value={empForm.mealAllowanceMonthly} onChange={(e) => setEmpForm({ ...empForm, mealAllowanceMonthly: Number(e.target.value) })} className="input-field" />
              </Field>
            </div>
            <Field label="Custo mensal p/ empresa (€, opcional)">
              <input type="number" min={0} step="0.01" value={empForm.monthlyCompanyCost} onChange={(e) => setEmpForm({ ...empForm, monthlyCompanyCost: Number(e.target.value) })} placeholder="0 = calcular automaticamente" className="input-field" />
            </Field>
            <Field label="Notas (opcional)">
              <input value={empForm.notes} onChange={(e) => setEmpForm({ ...empForm, notes: e.target.value })} placeholder="Ex.: renovação em janeiro" className="input-field" />
            </Field>
            <p className="text-xs text-text-muted">
              Se definires o custo mensal p/ empresa, é ESSE o valor usado no Planeamento e nos totais de equipa. Se ficar a 0, calcula-se automaticamente (salário + TSU 23,75% + subsídios, defaults PT). Prestação de serviços: indica o valor mensal do contrato no campo do salário.
            </p>
          </div>
        </Modal>
      </div>

      {/* Saiu da empresa: fica inativo, mas o custo dos meses passados continua
          a contar no planeamento financeiro. */}
      <ConfirmDialog
        open={!!empToDeactivate}
        onClose={() => setEmpToDeactivate(null)}
        onConfirm={async () => { if (empToDeactivate) { await doDeactivate(empToDeactivate); setEmpToDeactivate(null); } }}
        title="Desativar colaborador"
        confirmLabel="Desativar"
        description={empToDeactivate && (
          <><b className="text-text-primary">{empToDeactivate.fullName}</b> passa a inativo e deixa de contar para os
          custos futuros. O histórico dos meses em que cá esteve mantém-se — é o que deves usar quando alguém sai da empresa.</>
        )}
      />

      {/* Registo errado: apaga mesmo. */}
      <ConfirmDialog
        open={!!empToDelete}
        onClose={() => setEmpToDelete(null)}
        onConfirm={async () => { if (empToDelete) { await doDelete(empToDelete); setEmpToDelete(null); } }}
        title="Eliminar colaborador"
        tone="danger"
        confirmLabel="Eliminar definitivamente"
        escreverParaConfirmar={empToDelete?.fullName}
        description={empToDelete && (
          <>Vais apagar <b className="text-text-primary">{empToDelete.fullName}</b> e todo o seu histórico de custos.
          Esta ação não pode ser anulada. Se a pessoa apenas saiu da empresa, usa <b className="text-text-primary">Desativar</b>,
          para o planeamento dos meses passados continuar correto.</>
        )}
      />
    </RouteGuard>
  );
}

function SimField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-text-muted mb-1 block">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input-field py-1.5" />
    </label>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-surface-border last:border-0 text-[13px]">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary tabular-nums text-right">{value}</span>
    </div>
  );
}

function EmployeeDrawer({ employee, onClose, onDeactivate, onEdit }: {
  employee: Employee & { cost: ReturnType<typeof computeEmployeeCost> };
  onClose: () => void;
  onDeactivate: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface h-full overflow-y-auto p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-xs text-text-muted">Colaborador</p>
            <h2 className="text-xl font-semibold tracking-tight">{employee.fullName}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 -mr-1.5" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="card px-4 py-1">
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
            <ResultRow label="Custo mensal médio (calculado)" value={formatCurrency(employee.cost.averageMonthlyCost)} />
            <ResultRow
              label="Custo mensal p/ empresa (usado no Planeamento)"
              value={`${formatCurrency(effectiveMonthlyCost(employee, employee.cost))}${employee.monthlyCompanyCost && employee.monthlyCompanyCost > 0 ? " · manual" : " · automático"}`}
            />
            <ResultRow label="Custo anual total" value={formatCurrency(employee.monthlyCompanyCost && employee.monthlyCompanyCost > 0 ? employee.monthlyCompanyCost * 12 : employee.cost.totalAnnualCost)} />
          </PermissionGate>
        </div>
        <PermissionGate permission="manage_employees">
          <div className="mt-6 flex gap-2">
            <button onClick={onEdit} className="btn-primary text-sm flex-1">Editar dados</button>
            <button onClick={onDeactivate} className="btn-secondary text-sm text-danger flex-1">Desativar</button>
          </div>
        </PermissionGate>
      </div>
    </div>
  );
}
