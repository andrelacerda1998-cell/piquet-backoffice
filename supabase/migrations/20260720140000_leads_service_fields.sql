-- Campos de gestão do pedido no CRM: orçamento, valor do técnico (a margem da
-- Piquet = orçamento − valor do técnico), técnico, categoria, data de execução,
-- classificação, e ligação ao serviço criado quando o pedido é concluído.
alter table public.leads
  add column if not exists quote_value      numeric,
  add column if not exists technician_value numeric,
  add column if not exists technician_name  text,
  add column if not exists category_id      text,
  add column if not exists execution_date   timestamptz,
  add column if not exists rating           numeric,
  add column if not exists service_id       text;
