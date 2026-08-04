# Preservação de Dados — Backoffice Piquet

Garante que a reformulação **não elimina** dados, funcionalidades, filtros nem
ações. Princípio: reorganizar ≠ retirar. Onde algo sai da vista principal,
indica-se exatamente onde fica.

Legenda de estado: ✅ preservado no mesmo sítio · ↪️ movido (com destino) · ➕ passa a existir · 🔗 depende de integração real.

---

## 1. Matriz por módulo

| Página/módulo atual | Dados / ações | Nova localização | Apresentação | Estado |
|---|---|---|---|---|
| Visão Geral (`/`) | GMV, comissão, downloads, avaliação, LTV/CAC, cartões de depto, ⌘K | `/` (Painel) | KPIs + tempo-real da operação + drill-down por clique | ✅ / ➕ (tempo real) |
| Operações — tabela de serviços (todas as colunas + 7 sub-abas de estado) | id, data, cliente, técnico, categoria, serviço, zona, agendado, estado, valores, origem, avaliação, reclamação | `/servicos` | Tabela de trabalho (colunas configuráveis + vistas) + estados | ✅ (colunas voltam via config) |
| Operações — incidentes, funil | incidentes, funil | `/servicos` (tab) | Mantidos | ✅ |
| Pedidos personalizados | lista, estados, estimar, escolher técnicos | `/servicos/personalizados` | Igual (rota canónica) | ↪️ |
| Qualidade | avaliações, reclamações, incidentes | `/operacao/qualidade` | Igual (rota única, sem alias) | ↪️ 🔗 |
| Suporte | tickets, responder, mudar estado | `/suporte` (canónica) | Igual (elimina duplicado) | ↪️ |
| Clientes — lista/métricas/por local/origem/bloqueados | todos os campos + bloquear + notas + drawer | `/clientes` | Igual + drawer padronizado | ✅ 🔗 |
| Técnicos — lista/performance/suspensões | todos os campos + suspender + drawer | `/tecnicos` | Igual | ✅ 🔗 |
| Técnicos — KYC (Laravel) | documentos, aprovar/recusar, aviso por técnico | `/tecnicos` (tab Aprovações) | Mantido + perfil real | ✅ |
| Recrutamento | candidatos, estados, ações | `/tecnicos/recrutamento` | Igual (rota única) | ↪️ |
| Financeiro — Resumo | GMV, comissão, próximas faturas, estimativas | `/financeiro` | KPIs reais; estimativas marcadas/derivadas | ✅ (estimativas: ver P09) |
| Financeiro — Pagamentos da app | Payshop, testes, KPIs | `/financeiro/pagamentos-app` | Igual | ↪️ |
| Financeiro — Custos e faturas | faturas (repetição, editar, parcial), KPIs | `/financeiro/custos` | Igual | ↪️ |
| Financeiro — Planeamento | orçamento 12m, equipa, entradas, detalhe/mês | `/financeiro/planeamento` | Igual | ↪️ |
| Financeiro — Pagamentos a técnicos | payouts derivados, processar | `/financeiro/payouts` | Igual | ↪️ |
| Financeiro — Lucro do sistema (Laravel) | saldo wallet, transações, filtros | `/financeiro/lucro` | Igual | ↪️ |
| Impostos e RH | obrigações fiscais, colaboradores, simulador, TSU | `/financeiro/impostos` | Igual (rota única, sem alias) | ↪️ (fiscal 🔗) |
| Marketing — desempenho/funil/canais/CAC | Meta Ads, ROAS, CPL… | `/marketing` | Igual | ✅ |
| Marketing — CRM & Leads | orçamento, técnico, margem, mensagem, estados | `/marketing/crm` | Igual | ✅ |
| Marketing — Push/Códigos | campanhas push, códigos | `/marketing` (tabs) | Igual | ✅ (demo) |
| Produto | downloads, avaliações, integrações, funil Mixpanel | `/produto` | Igual | ✅ |
| Objetivos | 8 metas, snapshots | `/objetivos` | Igual | ✅ |
| Equipa (`/chat`) | mensagens, agenda, reuniões, tarefas equipa | `/chat` | Igual | ✅ |
| Tarefas (pessoal) | Kanban, repetição, lista | `/tarefas` | Igual | ✅ |
| Desenvolvimento | dev_tasks | `/desenvolvimento` | Igual | ✅ |
| Relatórios | gerar CSV, histórico | `/relatorios` | Igual | ✅ |
| Configurações — catálogo/preços/zonas | oferta, preços, zonas | `/configuracao` | Igual | ✅ |
| Configurações — Taxas (Laravel) | fees reais, editar | `/configuracao` (tab) | Igual | ✅ |
| Configurações — Documentos | exigidos, add/eliminar/alternar | `/configuracao` (tab) | Igual | ✅ |
| Configurações — Admins/Atividade | admins, log | `/configuracao/admin` | Igual + auditoria real | ✅ (log 🔗) |
| Despacho ao vivo | — | `/servicos/despacho` | Igual | 🔗 |
| Alertas | — | `/alertas` | Feed real acionável | ➕ 🔗 |

**Conclusão:** nenhuma página, tabela, coluna, filtro, KPI ou ação é eliminada.
A única mudança estrutural é **acabar com a duplicação página↔alias** (a casa
canónica passa a ser única) e **dividir 2 mega-páginas** (Financeiro, Marketing)
em rotas próprias — o conteúdo é exatamente o mesmo, com URL direto.

---

## 2. Dados no backend mas ainda não mostrados

- **Reservas ao vivo** (ciclo completo dos serviços) — existe no Laravel, ainda
  não apresentado (casca pronta). Ver `INTEGRACAO_LARAVEL_BACKOFFICE.md`.
- **Perfil real do técnico** (documentos por técnico) — dados no Laravel, o
  perfil ainda deriva fictícios.
- **Auditoria/atividade real** (quem fez o quê) — a modelar.
- **Divergências financeiras** (Payshop vs serviços) — calculáveis, não expostas.

Estes **passam a ser mostrados** à medida que as integrações ligam — nada se
perde, ganha-se.

---

## 3. Permissões (preservar acessos)

Ao introduzir RBAC real, garantir:
- `ceo`/`cto` mantêm acesso total (sem regressão).
- Cada nova função recebe exatamente as permissões do seu domínio (matriz no
  Design System / plano).
- Dados sensíveis (salários individuais, dados pessoais, financeiro) só a quem
  tem `view_salaries` / `view_individual_costs` / `view_personal_data` /
  `view_finance` — já existem como permissões; falta atribuí-las a funções.
- Nada de esconder informação **legal/auditoria/financeira** a quem tem direito
  a vê-la.

---

## 4. Regras de verificação (checklist por página reformulada)

Antes de dar por concluída a reformulação de cada página:
- [ ] Todas as colunas anteriores continuam acessíveis (na tabela ou config).
- [ ] Todos os filtros importantes preservados.
- [ ] Todas as ações (linha, massa, detalhe) preservadas.
- [ ] Todos os KPIs/gráficos preservados (ou marcados se demo).
- [ ] Histórico/timeline preservado.
- [ ] Export preservado.
- [ ] Deep-links `?tab=` antigos redirecionam para a casa nova.
- [ ] Sem regressão de permissões.
