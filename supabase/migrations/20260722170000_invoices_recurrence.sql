-- =============================================================================
-- Repetição nas faturas de custos (pedido do André 2026-07-22).
-- Quando uma fatura recorrente é saldada (pago), o servidor gera logo a
-- próxima ocorrência (datas avançadas pelo intervalo, pagamento a zero).
-- =============================================================================
alter table public.company_invoices
  add column if not exists recurrence text not null default 'nenhuma'
  check (recurrence in ('nenhuma','mensal','trimestral','semestral','anual'));
