/**
 * Seed do Supabase a partir dos dados mock.
 *
 * Uso (depois de criar o projeto Supabase e correr as migrações de supabase/migrations/):
 *   1. Preencher .env.local com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 *   2. npm run seed
 *
 * Idempotente (upsert por id). Insere na ordem de dependências e em lotes.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mockData } from "../src/mocks/data";
import { DEFAULT_SETTINGS } from "../src/config/dashboard";
import { TEAM_SEED_MESSAGES, TEAM_SEED_AGENDA, TEAM_SEED_TASKS } from "../src/services/extrasService";
import { buildTechnicianPayouts } from "../src/services/financeService";
import type { Customer, Technician, ServiceRequest, Employee, TaxObligation, MarketingCampaign } from "../src/types";

config({ path: ".env.local" });

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.error("Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

async function upsert<T extends object>(table: string, rows: T[], chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = rows.slice(i, i + chunk);
    const { error } = await db.from(table).upsert(batch as never, { onConflict: "id" });
    if (error) throw new Error(`${table}[${i}]: ${error.message}`);
    process.stdout.write(`  ${table}: ${Math.min(i + chunk, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ${table}: ${rows.length} ✓                    `);
}

async function main() {
  console.log("A semear Supabase a partir dos dados mock…");

  await upsert(
    "categories",
    DEFAULT_SETTINGS.categories.map((c) => ({ id: c.id, name: c.name, icon: c.slug }))
  );

  await upsert(
    "customers",
    (mockData.customers as Customer[]).map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone,
      registered_at: c.registeredAt, location: c.location, city: c.city,
      status: c.status, source: c.source,
    }))
  );

  await upsert(
    "technicians",
    (mockData.technicians as Technician[]).map((t) => ({
      id: t.id, name: t.name, email: t.email, phone: t.phone,
      categories: t.categories, specializations: t.specializations,
      location: t.location, city: t.city, status: t.status,
      documentation_complete: t.documentationComplete,
      registered_at: t.registeredAt, approved_at: t.approvedAt ?? null,
    }))
  );

  await upsert(
    "services",
    (mockData.services as ServiceRequest[]).map((s) => ({
      id: s.id, customer_id: s.customerId, technician_id: s.technicianId ?? null,
      category_id: s.categoryId, service_name: s.serviceName,
      location: s.location, city: s.city, source: s.source, status: s.status,
      requested_at: s.requestedAt, scheduled_at: s.scheduledAt ?? null,
      started_at: s.startedAt ?? null, completed_at: s.completedAt ?? null,
      total_customer_value: s.totalCustomerValue, technician_value: s.technicianValue,
      vat_value: s.vatValue, payment_status: s.paymentStatus, invoice_status: s.invoiceStatus,
      rating: s.rating ?? null, has_complaint: s.hasComplaint,
      cancellation_reason: s.cancellationReason ?? null,
      response_time_minutes: s.responseTimeMinutes ?? null,
      technician_assignment_time_min: s.technicianAssignmentTimeMinutes ?? null,
      campaign_id: s.campaignId ?? null, internal_notes: s.internalNotes ?? [],
    }))
  );

  await upsert(
    "employees",
    (mockData.employees as Employee[]).map((e) => ({
      id: e.id, full_name: e.fullName, email: e.email, phone: e.phone,
      job_title: e.jobTitle, department: e.department, contract_type: e.contractType,
      employment_status: e.employmentStatus, start_date: e.startDate, end_date: e.endDate ?? null,
      gross_monthly_salary: e.grossMonthlySalary, annual_salary_payments: e.annualSalaryPayments,
      meal_allowance_monthly: e.mealAllowanceMonthly, meal_allowance_months: e.mealAllowanceMonths,
      fixed_allowances_monthly: e.fixedAllowancesMonthly, variable_compensation_monthly: e.variableCompensationMonthly,
      annual_bonus: e.annualBonus, employer_social_security_rate: e.employerSocialSecurityRate,
      employee_social_security_rate: e.employeeSocialSecurityRate,
      workers_compensation_insurance_monthly: e.workersCompensationInsuranceMonthly,
      health_insurance_monthly: e.healthInsuranceMonthly, equipment_annual_cost: e.equipmentAnnualCost,
      software_annual_cost: e.softwareAnnualCost, training_annual_cost: e.trainingAnnualCost,
      recruitment_cost: e.recruitmentCost, other_monthly_costs: e.otherMonthlyCosts,
      other_annual_costs: e.otherAnnualCosts, notes: e.notes ?? null,
    }))
  );

  await upsert(
    "tax_obligations",
    (mockData.taxObligations as TaxObligation[]).map((t) => ({
      id: t.id, name: t.name, category: t.category, description: t.description,
      reference_period: t.referencePeriod, amount_estimated: t.amountEstimated,
      amount_confirmed: t.amountConfirmed ?? null, due_date: t.dueDate, payment_date: t.paymentDate ?? null,
      status: t.status, recurrence: t.recurrence, responsible_user_id: t.responsibleUserId ?? null,
      payment_reference: t.paymentReference ?? null, supporting_document: t.supportingDocument ?? null,
      notes: t.notes ?? null, reminder_days: t.reminderDays, is_estimated: t.isEstimated,
    }))
  );

  await upsert(
    "campaigns",
    (mockData.campaigns as MarketingCampaign[]).map((c) => ({
      id: c.id, platform: c.platform, campaign_name: c.campaignName, ad_set: c.adSet ?? null,
      creative: c.creative ?? null, investment: c.investment, impressions: c.impressions,
      reach: c.reach, frequency: c.frequency, clicks: c.clicks, ctr: c.ctr, cpc: c.cpc,
      leads: c.leads, cpl: c.cpl, customers: c.customers, cac: c.cac,
      piquet_revenue: c.piquetRevenue, roas: c.roas, status: c.status,
      start_date: c.startDate, end_date: c.endDate ?? null,
    }))
  );

  await upsert(
    "team_messages",
    TEAM_SEED_MESSAGES.map((m) => ({
      id: m.id, thread_id: m.threadId, author_id: null, author_name: m.author, text: m.text,
      // Ancora as horas ao dia de referência para ordenação estável.
      created_at: `2026-07-06T${m.time}:00`,
    }))
  );

  await upsert(
    "team_meetings",
    TEAM_SEED_AGENDA.map((e) => ({
      id: e.id, person: e.person, date: e.date, start_time: e.start, end_time: e.end,
      title: e.title, type: e.type, participants: e.participants ?? [], location: e.location ?? null,
    }))
  );

  await upsert(
    "team_tasks",
    TEAM_SEED_TASKS.map((t) => ({
      id: t.id, title: t.title, assignee: t.assignee, department: t.department,
      priority: t.priority, status: t.status, due: t.due,
    }))
  );

  await upsert(
    "technician_payouts",
    buildTechnicianPayouts().map((p) => ({
      id: p.id, technician_name: p.technicianName, services: p.services,
      amount_due: p.amountDue, period: p.period, status: p.status,
      processed_at: p.status === "processado" ? "2026-07-01T10:00:00" : null,
    }))
  );

  console.log("Seed concluído.");
}

main().catch((e) => { console.error(e); process.exit(1); });
