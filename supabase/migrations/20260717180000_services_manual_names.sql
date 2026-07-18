-- Serviços concluídos registados à mão guardam o nome do cliente/técnico
-- diretamente (não há FK para as tabelas, que estão vazias enquanto o backend
-- de reservas não liga). A leitura prefere o nome por relação e cai nestes.
alter table public.services add column if not exists customer_name text;
alter table public.services add column if not exists technician_name text;
