# Auditoria do Backoffice Piquet

> Análise completa **antes de qualquer alteração**. Feita sobre o código real
> (branch `feat/backoffice-melhorias-jul26`). Acompanha:
> `BACKOFFICE_INFORMATION_ARCHITECTURE.md`, `BACKOFFICE_UX_UI_AUDIT.md`,
> `BACKOFFICE_DATA_PRESERVATION.md`, `BACKOFFICE_DESIGN_SYSTEM.md`,
> `BACKOFFICE_IMPLEMENTATION_PLAN.md`.

---

## 1. Resumo executivo

**Estado atual.** Backoffice em Next.js 15 (App Router) + Tailwind + Supabase,
com 20 páginas, ~80 rotas de API e uma paleta própria (dourado #FAB347 + creme,
com dark mode). Funcionalmente é **rico** — cobre operações, clientes, técnicos,
financeiro, marketing, produto, suporte, RH e ferramentas internas. A base de
componentes e o design são **acima da média** para um backoffice.

**Pontos fortes**
- Design coerente e "premium" já hoje (tokens em CSS vars, dark mode, paleta quente).
- Camada de dados dual bem pensada (`api.ts`: demo↔real, "zero em vez de ficção").
- Honestidade de dados assumida (selo `<DemoBadge>`).
- Componentes reutilizáveis sólidos (DataTable, Modal, Tabs, drawers, MetricCard).
- Muitas ligações reais já feitas (serviços, faturas, planeamento, Payshop, Meta, Mixpanel; e agora Laravel: taxas, lucro, KYC).

**Principais problemas**
1. **Dados meio-reais.** ~18 endpoints ainda são demo (Resumo/estimativas, fiscal, qualidade, alertas, recrutamento, promoções…). Duas fontes (Supabase + Laravel) ainda por unificar — sintoma visível: lista de técnicos vazia ao lado de documentos KYC reais.
2. **RBAC inexistente na prática.** 25 permissões e um mapa rota→permissão definidos, mas só 2 perfis (`ceo`, `cto`), ambos `FULL_ACCESS`. Não há vistas por função (Operações, Financeiro, Suporte…).
3. **Arquitetura de navegação ambígua.** Vários módulos existem **em duplicado**: página própria + alias `?tab=` (Suporte, Qualidade, Recrutamento, Impostos, Pedidos personalizados). Confunde e dispersa.
4. **Números fabricados.** As variações "+X% vs mês anterior" são geradas a partir do valor atual em quase todo o lado; o Resumo tem estimativas calibradas à mão (runway, burn).
5. **Tabelas sem poder operacional.** Sem colunas configuráveis, vistas guardadas, ações em massa, fixar/redimensionar colunas.
6. **Pesquisa global não pesquisa entidades.** O ⌘K encontra páginas/comandos, não serviços por id, clientes por telefone, etc.
7. **Detalhe inconsistente.** Há drawers (serviço, cliente, técnico) mas sem timeline unificada nem estrutura de tabs consistente; o detalhe do técnico deriva documentos fictícios.
8. **Notificações não saem do ecrã.** Só polling de 45s com a app aberta; sem email/push.

**Oportunidades**
- Unificar as duas fontes de dados (spec Laravel já escrita) → mata metade dos problemas.
- RBAC real + dashboards por perfil.
- Pesquisa global de entidades + vistas guardadas + ações em massa (grande ganho operacional).
- Timeline/detalhe unificados (serviço, cliente, técnico).

**Avaliação global: 6,5 / 10.**
Boa base visual e de componentes; penalizado pela realidade dos dados, ausência
de RBAC e por padrões operacionais em falta (pesquisa de entidades, vistas,
ações em massa). Com as ligações reais + RBAC + pesquisa, sobe facilmente a 8,5+.

---

## 2. Inventário completo (por página)

| Área | Página (rota) | Objetivo | Dados apresentados | Ações | Problemas | Prioridade |
|---|---|---|---|---|---|---|
| Visão geral | `/` | Centro de controlo executivo | GMV, comissão, downloads, avaliação, unit economics (LTV/CAC), cartões de depto, ⌘K | Abrir comandos, ir a deptos | Estimativas demo; deltas fabricados; não é "tempo real" da operação | **Alta** |
| Operações | `/servicos` | Gerir serviços/reservas | Tabela de serviços (7 estados em sub-abas), incidentes, funil | Registar serviço, filtrar, ordenar, export CSV, abrir detalhe | Só serviços concluídos manuais (sem reservas ao vivo); sem reatribuir/reagendar/reembolso; drawer limitado | **Crítica** |
| Clientes | `/clientes` | Gerir clientes | Lista, métricas, por localização/origem, bloqueados, suporte | Bloquear, notas, abrir drawer | Tabela seed-vazia até reservas; suporte é alias | Alta |
| Técnicos | `/tecnicos` | Gerir técnicos + KYC | Lista, performance, suspensões, **KYC real (Laravel)**, aviso de docs por validar | Aprovar/recusar doc, suspender, drawer | Lista vazia (Supabase) vs docs reais (Laravel) — fontes por unir; perfil deriva docs fictícios | **Crítica** |
| Financeiro | `/financeiro` | Finanças | Resumo (GMV, próximas faturas), Pagamentos app (Payshop), Custos/faturas, Planeamento, Pagamentos a técnicos, Impostos e RH, **Lucro do sistema (Laravel)** | Marcar paga, nova/editar fatura c/ repetição, processar payout, orçamento | Resumo/estimativas demo; muitos módulos num só ecrã (denso) | Alta |
| Produto | `/produto` | Analytics de produto | Downloads (lojas), avaliações, integrações (crons), **Funil (Mixpanel)** | Escolher período do funil | `product/metrics` demo | Média |
| Marketing | `/marketing` | Aquisição + CRM | Desempenho (Meta), funil, canais, CAC, **CRM & Leads**, Push, Códigos | Editar lead (orçamento/margem/estado), criar/eliminar, push, códigos | Push/códigos demo | Alta |
| Equipa | `/chat` | Chat + agenda + tarefas de equipa | Mensagens (real), agenda, reuniões, tarefas de equipa | Enviar msg, criar tarefa/reunião | — | Baixa |
| Desenvolvimento | `/desenvolvimento` | Kanban de dev (Rodrigo) | dev_tasks reais | Mover/criar tarefa | — | Baixa |
| Tarefas | `/tarefas` | Kanban pessoal do André | personal_tasks (real) | Criar/mover/repetição, lista | — | Baixa |
| Configurações | `/configuracao` | Catálogo, preços, zonas, **taxas reais (Laravel)**, documentos, admins, atividade | Fees (API), documentos exigidos, admins, log | Editar taxas, add/eliminar documento, gerir admins | Admins/atividade demo/persistidos | Média |
| Impostos e RH | `/impostos-rh` (via `/financeiro?tab=impostos`) | Fiscal + colaboradores | Obrigações fiscais (demo), colaboradores (real), simulador, TSU | Add/editar colaborador, custo manual, marcar imposto pago | Fiscal demo; página embutida noutra | Média |
| Objetivos | `/objetivos` | Metas do ano | 8 objetivos com métrica real + snapshots | Editar objetivo | — | Baixa |
| Relatórios | `/relatorios` | Exportações | Gera CSV real por período; histórico local | Gerar, re-descarregar, remover | Só CSV | Baixa |
| Pedidos personalizados | `/servicos-personalizados` | Pedidos fora do catálogo | Lista, estados | Estimar, escolher técnicos | Demo | Média |
| Qualidade | `/qualidade` (+ alias) | Avaliações/reclamações | Métricas de qualidade | — | Demo; duplicada com alias | Média |
| Suporte | `/suporte` (+ alias) | Inbox de tickets | Tickets (real via app) | Responder, mudar estado | Duplicada com `/clientes?tab=suporte` | Média |
| Recrutamento | `/recrutamento` (+ alias) | Candidaturas a técnico | Candidatos, estados | Aprovar/entrevista | Demo; duplicada | Baixa |
| Despacho ao vivo | `/despacho` | Serviços ao vivo | — | — | Demo; fora do menu principal | Baixa |
| Alertas | `/alertas` | Feed de alertas | — | — | Demo; devia agregar sinais reais | Média |

---

## 3. Inventário técnico

- **Rotas API (~80)** em 22 áreas: `finance` (15), `technicians` (6), `employees` (6), `marketing` (6), `team` (5), `product` (4), `customers` (4), `cron` (4), `tax` (3), `support` (3), `vendor-documents` (3), `webhooks` (3), `dashboard` (2), `services` (2), `goals` (2), `tasks` (2), `dev-tasks` (2), `vouchers` (2), `fee-settings` (1), `system-profit` (1), `leads` (1), `tickets` (1).
- **Componentes UI (22)**: `DataTable`, `Modal`+`Field`, `Tabs`/`SubTabs`, `MetricCard`, `StatusBadge`, `DemoBadge`, `States` (loading/error/vazio), `Toaster`, `MonthSelect`, `WelcomeBanner`, `DepartmentCard`; drawers: `ServiceDetailDrawer`, `CustomerDetailDrawer`, `TechnicianDetailDrawer`, `TechApprovalDrawer`, `SupportTicketDrawer`; painéis: `AppBookingsPanel`, `AppCustomersPanel`, `AppTechniciansPanel`, `ProSupportPanel`, `SupportInbox`. Gráficos: `Charts.tsx` (Line/Bar/Area/Donut/CashFlow/Funnel).
- **Permissões**: 25 (`view_*`, `manage_*`, `edit_*`, `destructive_actions`, `export_data`…), mapa `ROUTE_PERMISSIONS` completo, mas `ROLE_PERMISSIONS` = { ceo: full, cto: full }. `PermissionGate` usado em pontos do Financeiro/RH.
- **Integrações reais**: App Store/Play (downloads), Meta Ads, Mixpanel (funil), Payshop/Paylands (pagamentos), Laravel admin (taxas, lucro, vouchers, KYC), Supabase (auth + dados internos).
- **Fonte de dados**: dual — Supabase (`_lib/*`, Route Handlers) + Laravel (`laravelAdmin.ts`). Serviços/Clientes/Técnicos ainda por migrar para Laravel (casca dos Serviços já pronta e dormente).

---

## 4. Problemas (registados)

> Severidade: 🔴 crítica · 🟠 alta · 🟡 média · ⚪ baixa

| ID | Página/área | Descrição | Impacto | Sev. | Solução proposta | Esforço | Ficheiros |
|---|---|---|---|---|---|---|---|
| P01 | Global (dados) | ~18 endpoints demo; 2 fontes (Supabase+Laravel) por unir | Decisões sobre dados incompletos | 🔴 | Ligar Serviços/Clientes/Técnicos ao Laravel (spec pronta) | Alto (depende do Rodrigo) | `_lib/laravelServices.ts`, `api.ts` |
| P02 | Global (RBAC) | Só 2 perfis, ambos full | Sem vistas por função; risco de acesso a dados sensíveis | 🔴 | RBAC real + `ROLE_PERMISSIONS` por função + dashboards por perfil | Médio | `lib/permissions.ts`, `RouteGuard.tsx` |
| P03 | Navegação | Módulos em duplicado (página + alias `?tab=`) | Confusão, dispersão | 🟠 | IA nova: uma casa por módulo (ver IA doc) | Médio | `config/dashboard.ts`, `Sidebar.tsx` |
| P04 | Global (métricas) | Deltas "vs mês anterior" fabricados | Falsa confiança | 🟠 | Calcular deltas reais ou omitir | Médio | `lib/calculations.ts`, páginas |
| P05 | Operações | Sem reservas ao vivo; sem reatribuir/reagendar/reembolso; drawer pobre | Não serve a operação diária real | 🔴 | Ligar reservas (Laravel) + ações no drawer + timeline | Alto | `servicos/page.tsx`, `ServiceDetailDrawer.tsx` |
| P06 | Tabelas | Sem colunas configuráveis/vistas guardadas/ações em massa | Lentidão operacional | 🟠 | Evoluir `DataTable` (colunas, vistas, seleção, bulk) | Médio | `DataTable.tsx` |
| P07 | Pesquisa | ⌘K não pesquisa entidades | Não se encontra um serviço/cliente rápido | 🟠 | Pesquisa global de entidades (id, telefone, email…) | Médio | `CommandPalette.tsx`, nova rota `search` |
| P08 | Técnicos | Perfil deriva documentos fictícios; lista vazia | Enganador | 🟠 | Perfil real ligado a vendor-documents (após P01) | Médio | `TechnicianDetailDrawer.tsx` |
| P09 | Financeiro | Resumo/estimativas demo (runway, burn, cash-flow) | Números inventados no ecrã executivo | 🟠 | Derivar do real (Planeamento+bancos) ou marcar/retirar | Médio | `financeiro/page.tsx` |
| P10 | Notificações | Só polling com app aberta | Eventos críticos perdem-se | 🟡 | Canal real (email/WhatsApp) + centro de alertas | Médio | `NotificationBell.tsx`, backend |
| P11 | Alertas | Página demo, não agrega sinais reais | Ferramenta ociosa | 🟡 | Feed real (faturas vencidas, crons falhados, docs, leads) | Médio | `alertas/page.tsx` |
| P12 | Código | Constante de comissão (0.25) duplicada; alguns valores hardcoded | Manutenção/erros | ⚪ | Centralizar em `config` | Baixo | vários |
| P13 | Detalhe | Sem timeline consistente (serviço/cliente/técnico) | Falta de contexto/histórico | 🟡 | Componente `Timeline` reutilizável | Médio | novos + drawers |
| P14 | Segurança | Password partilhada; sem contas por pessoa; log de atividade demo | Risco quando for o backoffice único | 🟠 | Contas por utilizador + auditoria real | Médio | Supabase auth, `configuracao` |
| P15 | Copys | Estados/labels de leads e serviços já corrigidos; falta uniformizar botões genéricos ("Guardar", "OK") | Consistência | ⚪ | Revisão de copy (ver UX/UI doc) | Baixo | vários |

---

## 5. Prioridades (visão macro)

1. **Correções críticas / desbloqueios** — ligar dados reais (Serviços→Clientes→Técnicos, Laravel), RBAC real, ações de operação nos serviços.
2. **Quick wins** — pesquisa global de entidades, vistas guardadas, ações em massa, matar deltas fabricados, unificar navegação (tirar aliases duplicados).
3. **Estrutura** — dashboards por perfil, timeline/detalhe unificados, centro de alertas real.
4. **Polimento** — design system formalizado, copy, acessibilidade, performance.

Detalhe e sequência em `BACKOFFICE_IMPLEMENTATION_PLAN.md`.
