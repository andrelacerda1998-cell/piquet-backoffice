# Backoffice Piquet — estado actual

Levantamento a 8 de Setembro de 2026. Só inventário: o que existe, de onde vêm
os dados e o que se pode fazer. Os juízos ficam no `02-problems.md`.

## Números

| | |
|---|---|
| Ecrãs no menu | 14 (mais 7 acessíveis por ⌘K ou URL) |
| Ficheiros TypeScript | 370 · 44 685 linhas |
| Rotas de API | 146 |
| Endpoints registados como reais | 97 |
| Cartões de KPI | 108 em 10 ecrãs |
| Tabelas em Supabase | 30 (mais 4 vistas e 4 tabelas `_seed_backup_`) |

## De onde vêm os dados

O backoffice lê de **três sistemas** que não se conhecem entre si.

**Laravel** (`/v1/admin/*`, backend de produção) — é onde vive a operação real:
serviços, técnicos, clientes, documentos KYC, zonas, tipos de serviço,
vouchers, pagamentos a técnicos, notificações enviadas, códigos SMS,
localizações ao vivo. 31 endpoints usados.

**Supabase** (base do próprio backoffice) — pedidos (leads), conversas de
WhatsApp, difusões a técnicos, pagamentos Payshop, faturas de custos,
obrigações fiscais, colaboradores, objetivos, tarefas, mensagens de equipa,
métricas de anúncios e de downloads.

**Payshop/Paylands** — os pagamentos reais dos clientes, que definem o GMV.

Contagens reais nas tabelas de Supabase que espelham a operação:

| tabela | linhas | nota |
|---|---|---|
| `pop_transactions` | 170 | pagamentos reais |
| `ad_metrics` | 134 | Google/Meta |
| `leads` | 32 | pedidos |
| `tax_obligations` | 27 | |
| `dev_tasks` | 55 | tarefas de desenvolvimento |
| `services` | **1** | os serviços reais estão no Laravel |
| `technicians` | **1** | idem |
| `customers` | **1** | idem |
| `support_tickets` | **0** | |
| `lead_dispatches` | **0** | difusão a técnicos, ainda por estrear |
| `technician_phones` | **0** | enche no cron das 06:50 |

## Áreas

### Visão geral (`/`)
- **Objetivo:** estado executivo do negócio.
- **Informação:** 12 KPIs — GMV do mês e do ano, comissão Piquet do mês e do
  ano, serviços executados e agendados (mês e ano), downloads da app,
  avaliação nas lojas, CAC, serviços por cliente, LTV, rácio LTV/CAC.
- **Separadores:** Resumo · Objetivos do ano · Relatórios.
- **Ações:** nenhuma — é um ecrã de leitura.
- **APIs:** `/finance/gmv`, `/finance/summary`, `/services/counts`,
  `/product/growth`, `/finance/unit-economics`, `/goals`.

### Alertas (`/alertas`)
- **Objetivo:** o que precisa de acção hoje.
- **Regras** (`src/lib/alertRules.ts`): pedidos por responder, técnicos que
  aceitaram e aguardam decisão, integrações paradas (crons falhados), tickets
  de suporte abertos, documentos KYC pendentes, faturas de custos vencidas,
  impostos vencidos, dias sem dados de anúncios, pagamentos recusados.
- **Ações:** adiar (`alert_snoozes`), abrir o ecrã onde se resolve.
- **APIs:** `/alerts`, `/alerts/snooze`.
- **Nota:** é a mesma fonte das bolinhas do menu (`navBadges.ts`).

### Pedidos (`/leads`)
- **Objetivo:** o ciclo completo de um pedido, do formulário ao técnico.
- **Estados:** Novo · À procura de técnico · Com técnico · Concluído · Perdido.
- **Informação:** lista com pesquisa, mês, estado, categoria e origem;
  detecção de duplicados; motivos de perda; KPIs de conversão e pipeline.
- **Detalhe:** dados do pedido, conversa de WhatsApp com envio, painel de
  difusão a técnicos (escolher, enviar, ver quem aceitou, atribuir).
- **Ações:** criar, editar, apagar, responder por WhatsApp, enviar modelo,
  difundir a técnicos, atribuir técnico, exportar CSV.
- **APIs:** `/marketing/leads`, `/marketing/leads/:id`, `.../messages`,
  `.../dispatch`, `.../assign`; entrada pública em `POST /api/leads`.

### Operações (`/servicos`)
- **Objetivo:** os serviços executados.
- **Separadores:** Serviços · Reservas da app · Incidentes · Desempenho (SLA) ·
  Pedidos personalizados.
- **Filtros:** Todos · Pendentes · Agendamentos · Em curso · Concluídos ·
  Cancelados · Recusados/Sem técnico.
- **Fonte:** Laravel (`/v1/admin/services`), mais o backend Express das
  reservas da app.
- **Ações:** editar serviço (inclui trocar de técnico), declarar falta do
  técnico.

### Qualidade (`/qualidade`)
- **Objetivo:** avaliações e faltas.
- **Separadores:** Visão geral · Baixa avaliação · Indicadores · Faltas.
- **14 KPIs.** Parcialmente mock.

### Clientes (`/clientes`)
- **Separadores:** Visão geral · Todos os registos · Reclamações; e dentro:
  Resumo · Por origem · Por localização; Todos · Bloqueados · Podem pedir
  serviços · Não podem.
- **Ações:** bloquear/reativar, ver métodos de pagamento, apagar método.
- **APIs:** `/customers*` (Laravel), `/customers/metrics|trend|retention`.

### Técnicos (`/tecnicos`)
- **Separadores:** Visão geral · Lista · Aprovações e KYC; e dentro: Resumo ·
  Por categoria · Cobertura · Mapa ao vivo; Pendentes · Aprovados · Recusados;
  Todos · Suspensões · AT validada · AT por validar.
- **Detalhe:** dados pessoais e de empresa, NIF, IBAN, categorias, morada
  fiscal, estado da AT, workspace de faturação, botão para o criar.
- **Ações:** suspender, reativar, aprovar/recusar documentos, criar workspace
  de faturação, criar conta de teste.
- **13 KPIs.**

### Financeiro (`/financeiro`)
- **Separadores:** Resumo · Pagamentos da app · Custos e faturas ·
  Planeamento · Pagamentos a técnicos · Impostos e RH · Lucro do sistema.
- **23 KPIs** — o ecrã com mais indicadores do backoffice.
- **Ações:** reembolsar e cancelar cativo (Payshop), marcar fatura paga,
  editar orçamento, pagar técnico, marcar imposto pago.

### Marketing (`/marketing`)
- **Separadores:** Campanhas e desempenho (Campanhas · Funil · Canais · CAC ·
  Investimento) · Comunicação (Push · Códigos de desconto · Guiões).
- **Ações:** criar campanhas e anúncios na Meta e no Google, carregar imagens,
  ligar leads a clientes, definir modelo de acompanhamento do Google.
- **Nota:** o separador Push guarda em `localStorage` e gera métricas com
  `Math.random()`.

### Produto (`/produto`)
- **Separadores:** Apps · Bugs · Funil do produto · Logs · Integrações.
- **Integrações:** estado dos crons, WhatsApp (número e modelos), chaves.

### Suporte (`/suporte`)
- Caixa de entrada de tickets. Tabela com **0 linhas**.

### Equipa (`/chat`)
- **Separadores:** Conversas · Tarefas · Agenda e reuniões.
- 15 mensagens, 9 tarefas, 0 reuniões.

### Desenvolvimento (`/desenvolvimento`)
- 55 tarefas de desenvolvimento.

### Configurações (`/configuracao`)
- **Separadores:** Serviços e preços (Catálogo · Preços · Zonas · Taxas e
  comissões · Documentos) · Administração (Administradores · Atividade ·
  Notificações enviadas · Códigos SMS).

### Fora do menu (⌘K ou URL)
`/tarefas` (kanban pessoal, 14 tarefas) · `/objetivos` · `/relatorios` ·
`/servicos-personalizados` · `/recrutamento` · `/impostos-rh`.

## Transversais

**Autenticação e papéis.** Supabase Auth; `ROLE_PERMISSIONS` e
`ROUTE_PERMISSIONS` em `src/lib/permissions.ts`; `RouteGuard` valida a sessão
real em cada ecrã. 3 contas em `staff`.

**Pesquisa global.** `/api/search` procura em serviços, clientes, técnicos,
faturas, pedidos e tickets — **todos em Supabase**.

**Selo de demonstração.** `<DemoBadge>` marca os ecrãs cujos dados são
fictícios, a partir da lista `REAL_DATA` em `src/services/api.ts`.

**Automatismos (crons na Vercel).** `ad-metrics`, `app-metrics`,
`metric-snapshots`, `pop-transactions`, `technician-phones`. A saúde de cada um
fica em `cron_runs` e aparece em Produto → Integrações.

**Webhooks.** Paylands (pagamentos), WhatsApp (mensagens recebidas), Outlook
(faturas de fornecedores).
