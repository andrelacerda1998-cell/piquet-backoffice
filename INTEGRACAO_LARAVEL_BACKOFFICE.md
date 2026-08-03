# Ligar o backoffice (Next.js) aos dados reais do Laravel

Lista dos endpoints que faltam expor na **API de admin do Laravel** (`v1/admin/*`)
para o backoffice deixar de usar dados manuais/seed e passar a ler a operação
real (reservas, clientes, técnicos, pagamentos).

Segue o mesmo padrão que já usaste para **Taxas, Lucro do sistema, Vouchers e
KYC** (`src/lib/laravelAdmin.ts`): servidor-a-servidor, `Bearer` do
`AdminApiToken`, envelope `{ data: ... }`. Do lado do Next, cada endpoint é
ligado um de cada vez (o `api.ts` já está preparado) — tu expões, eu mapeio.

---

## Convenções (para todos os endpoints)

- **Base / auth:** `GET {LARAVEL_ADMIN_API_URL}/v1/admin/...` com `Authorization: Bearer <AdminApiToken>` (já feito).
- **Envelope:** `{ "data": ... }` (como no `system-profit`).
- **Paginação:** quando a lista é grande, `data = { "items": [...], "meta": { "current_page", "last_page", "per_page", "total" } }`.
- **Datas:** ISO 8601 em UTC (ex.: `2026-07-29T10:00:00Z`).
- **Dinheiro:** euros em decimal (ex.: `104.55`). Se guardas em cêntimos, diz-me e converto eu.
- **Nomes dos campos:** à tua escolha (snake_case está ótimo). O mapeamento para o que o frontend usa é feito no Route Handler do Next — não te preocupes com isso.

---

## Prioridade 1 — Serviços / Reservas  ⭐ (o desbloqueio principal)

Alimenta a aba **Operações** e, por derivação, **Clientes, Técnicos, GMV e Financeiro**.

### `GET /v1/admin/services`
Lista paginada. **Query:** `page`, `per_page`, `status`, `from`, `to`, `search`, `city`, `technician_id`, `customer_id`.

Cada item (`data.items[]`):

| Campo | Notas |
|---|---|
| `id` | |
| `customer_id`, `customer_name` | |
| `technician_id`, `technician_name` | nulos se ainda sem técnico |
| `category_id`, `category_name` | |
| `service_name` | |
| `location`, `city` | |
| `source` | app / web / etc. |
| `status` | ver **Mapa de estados** abaixo |
| `requested_at`, `scheduled_at`, `started_at`, `completed_at` | ISO; nulos conforme a fase |
| `total_customer_value` | € cobrado ao cliente |
| `technician_value` | € do técnico |
| `piquet_revenue` | comissão Piquet (ou calculo eu = total − técnico) |
| `vat_value` | IVA, se tiverem |
| `payment_status` | pendente / pago / parcial / reembolsado / falhado |
| `invoice_status` | se existir (senão ignoro) |
| `rating` | 1–5 ou nulo |
| `has_complaint` | booleano |
| `cancellation_reason` | quando cancelado |
| `response_time_minutes`, `technician_assignment_time_min` | se existirem (métricas de qualidade) |

### `GET /v1/admin/services/{id}`
Detalhe — os mesmos campos + `internal_notes[]` e histórico de estados, se houver.

---

## Prioridade 2 — Clientes

Alimenta a aba **Clientes** (lista, segmentos, métricas).

### `GET /v1/admin/customers`
Paginada. **Query:** `page`, `per_page`, `search`, `city`, `from`, `to`.

Campos: `id`, `name`, `email`, `phone`, `registered_at`, `location`, `city`, `source`, `last_service_at`.

Métricas por cliente (`service_count`, `total_spent`, `piquet_revenue`, `complaint_count`, `average_rating`): **inclui-as se for barato no Laravel**; senão, o dashboard calcula-as a partir dos serviços — sem problema.

### `GET /v1/admin/customers/{id}`
Detalhe + serviços do cliente.

---

## Prioridade 3 — Técnicos / Vendors

Já tens o **KYC** (`vendor-documents`). Falta a **lista e o perfil** dos técnicos.

### `GET /v1/admin/vendors`
Paginada. **Query:** `page`, `per_page`, `search`, `city`, `status`, `category`.

Campos: `id`, `name`, `email`, `phone`, `categories[]`, `specializations[]`, `location`, `city`, `status`, `documentation_complete`, `registered_at`, `approved_at`, `last_activity_at`.

Métricas (`services_completed`, `acceptance_rate`, `cancellation_rate`, `average_rating`, `piquet_revenue`, `amount_received`): daqui ou derivadas pelo dashboard.

### `GET /v1/admin/vendors/{id}`
Detalhe do técnico.

---

## Prioridade 4 — Pagamentos

Complementa/valida o que já vem do Payshop (aba **Pagamentos da app**).

### `GET /v1/admin/payments`
Paginada. Campos: `id`, `service_id`, `customer_name`, `amount`, `method`, `status`, `created_at`, `captured_at`, `refunded_at`.

---

## Agregados (opcional)

O dashboard **já sabe derivar** GMV, receita por técnico/categoria, resumo
financeiro, etc., a partir dos serviços. Só vale a pena exporem endpoints
prontos (`/v1/admin/finance/summary`, ...) se já os têm calculados e mais
fiáveis do lado do Laravel. Caso contrário, expõe só as entidades cruas acima
e eu monto os agregados no dashboard.

---

## Mapa de estados (importante)

A aba Operações usa estes 15 estados. Preciso que me digas **como os estados do
Laravel correspondem a estes** — ou então expõe o estado "cru" e eu faço o mapa:

`pedido_recebido, a_procurar_tecnico, tecnico_encontrado, a_aguardar_orcamento,
orcamento_enviado, a_aguardar_pagamento, pago, agendado, em_execucao,
concluido, cancelado_cliente, cancelado_tecnico, sem_tecnico_disponivel,
reembolsado, em_reclamacao`

---

## O que **fica no dashboard** (Supabase — NÃO precisa do Laravel)

Para não haver dúvidas sobre a fronteira, isto é gestão interna e continua no Supabase:

- **Planeamento financeiro** (orçamento mensal) e **faturas de custos** (fornecedores: renda, software…).
- **Colaboradores internos** (Impostos e RH) — a equipa Piquet, não os técnicos.
- **Tarefas pessoais** (Kanban), **objetivos do ano**.
- **Leads da landing** (piquetapp.com → CRM).
- **Integrações** já reais: downloads das lojas, Meta Ads, Mixpanel, Payshop.

---

## Como ligamos (do meu lado)

Para cada endpoint que expuseres, eu:
1. Crio o Route Handler no Next que chama `laravelAdminRequest("/v1/admin/...")`.
2. Mapeio os campos para o que o ecrã usa.
3. Passo o endpoint de demo → real no `api.ts` (`LIVE_EXACT` + `REAL_DATA`), sem partir os outros.

Sugestão de ordem: **Serviços → Clientes → Técnicos → Pagamentos**. Assim que
os Serviços estiverem ligados, Clientes/Técnicos/GMV ganham logo dados reais por
derivação.
