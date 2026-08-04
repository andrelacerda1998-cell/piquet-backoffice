# Auditoria UX/UI — Backoffice Piquet

Análise por padrão de interação, com problemas e recomendações. Severidade
🔴/🟠/🟡/⚪.

---

## 1. Perfis de utilizador (hoje vs. desejado)

Hoje **todos os utilizadores veem tudo** (2 perfis, ambos full — ver Audit P02).
Experiência desejada por perfil:

| Perfil | Vê / faz com mais frequência | Página de entrada ideal | Não deve ver |
|---|---|---|---|
| CEO | GMV, crescimento, unit economics, objetivos | Painel executivo | — |
| Operações | Serviços sem técnico, atrasados, incidentes, despacho | Serviços (vista "precisa de ação") | Salários individuais |
| Apoio ao cliente | Tickets, reclamações, perfil do cliente/serviço | Suporte | Financeiro sensível |
| Financeiro | Pagamentos, payouts, faturas, IVA, divergências | Financeiro | Dados de marketing |
| Marketing/Growth | Meta/Google Ads, CAC, ROAS, funil, leads | Crescimento | Salários, payouts |
| Gestão técnicos | KYC, aprovações, performance, suspensões | Técnicos | Salários da equipa interna |
| Developer | Kanban dev, integrações, estado de crons | Desenvolvimento | Salários, financeiro |
| Admin | Utilizadores, permissões, auditoria, taxas | Administração | — |

**Recomendação:** RBAC real (grupos de permissão por função) + **página de
entrada por perfil** + o menu esconde módulos sem permissão.

---

## 2. Tabelas (`DataTable.tsx`)

**Bom:** ordenação controlada, paginação, `onRowClick`, `emptyMessage`, render por coluna, responsivo básico.

**Falta (🟠):**
- Escolher / reordenar / redimensionar / **fixar** colunas.
- **Vistas guardadas** ("Serviços sem técnico", "Pagamentos pendentes"…).
- **Seleção múltipla + ações em massa.**
- Densidade configurável (compacto/confortável).
- Exportação a partir da própria tabela (hoje é por página).
- Menu "⋯" por linha para ações secundárias (evitar 4–5 botões visíveis).

**Recomendação:** evoluir `DataTable` para um componente de tabela "de trabalho"
(colunas configuráveis + vistas + seleção + bulk + menu de contexto), reutilizado
por Serviços, Clientes, Técnicos, Pagamentos, Faturas.

---

## 3. Filtros

**Hoje:** `useFilters` + `MonthSelect` + pesquisa por página; inconsistente entre
páginas; sem vistas guardadas.

**Recomendação (🟠):**
- Barra de filtros consistente: os 2–3 mais usados visíveis; o resto em
  **"Filtros avançados"** (drawer/popover).
- Filtros **combináveis, persistentes e visíveis quando ativos** (chips com "×").
- **Vistas guardadas** partilháveis por equipa.
- Conjunto por área (estado, data, categoria, técnico, cliente, zona, avaliação,
  valor, método de pagamento, origem, responsável, prioridade, reclamação,
  reembolso).

---

## 4. Pesquisa global (🟠)

**Hoje:** `CommandPalette` (⌘K) navega para páginas/comandos — **não pesquisa
entidades**.

**Recomendação:** pesquisa universal por id de serviço, nome/email/telefone de
cliente, nome/id de técnico, morada, fatura, pagamento, transação, reclamação,
ticket. Resultados **agrupados por tipo**, tolerante a erros, parcial, com
contexto suficiente e navegação direta ao detalhe; guardar pesquisas recentes;
atalho de teclado. (Requer endpoint `search` que consulte várias fontes.)

---

## 5. Páginas de detalhe / drawers

**Hoje:** `ServiceDetailDrawer`, `CustomerDetailDrawer`, `TechnicianDetailDrawer`,
`TechApprovalDrawer`, `SupportTicketDrawer` — úteis mas **inconsistentes** entre
si e sem timeline.

**Recomendação:** estrutura única de detalhe:
- **Topo:** identificação, estado (badge), info principal, **ações principais**, última atualização.
- **Tabs:** Resumo · Atividade · Serviços · Pagamentos · Documentos · Avaliações · Suporte · Notas internas · Histórico (conforme a entidade).
- **Timeline** reutilizável (criação, mudanças de estado, notificações, aceites, cancelamentos, pagamentos, reembolsos, mensagens, intervenções da equipa).
- Técnico: substituir documentos **derivados/fictícios** por reais (vendor-documents).

---

## 6. Ações & prevenção de erros

**Hoje:** confirmações via `window.prompt/confirm` em vários sítios (ex.: registar
parcial de fatura, custo manual do colaborador) — 🟡 inconsistente e pouco claro.

**Recomendação:**
- Ações rápidas acessíveis (contactar cliente/técnico, reatribuir, reagendar,
  reembolso, alterar estado, nota, aprovar, suspender, copiar id/contacto).
- **Ações sensíveis** (reembolso, cancelar, bloquear, suspender, alterações
  financeiras) → **modal de confirmação** que explica consequências, exige
  **motivo** quando crítico, bloqueia duplo-clique, mostra loading e feedback.
- Registo de auditoria (quem/quando/porquê) — hoje é demo (P14).

---

## 7. Estados & cores

**Hoje:** `StatusBadge` central (bom), mas há mapeamentos de cor **repetidos e por
vezes divergentes** por página (ex.: tons de estado de fatura/lead definidos
localmente).

**Recomendação:** catálogo único de estados (Novo, Pendente, Agendado, Aceite,
Em curso, Concluído, Cancelado, Falhou, Reembolsado, Em análise, Bloqueado,
Suspenso…) com **cor + texto + ícone + tooltip**, e **nunca só cor**. Ver
`BACKOFFICE_DESIGN_SYSTEM.md §Estados`.

---

## 8. Gráficos & analytics

**Hoje:** `Charts.tsx` cobre Line/Bar/Area/Donut/CashFlow/Funnel; alguns gráficos
sobre dados demo.

**Recomendação:** cada gráfico deve responder a **uma pergunta**, ter título,
período, comparação, tooltip, filtros, aprofundamento e estado vazio correto.
Onde um KPI chega, não pôr gráfico; onde a tabela comunica melhor, usar tabela.
Retirar gráficos sobre dados fabricados até serem reais.

---

## 9. Números fabricados (🟠 — honestidade)

As variações "+X% vs mês anterior" são geradas do valor atual (`buildMetricValue`/
`seriesComparison`) em quase todo o lado, mesmo por cima de números reais. O
Resumo do Financeiro tem estimativas calibradas à mão (runway, burn, cash-flow).

**Recomendação:** deltas só quando há histórico real; caso contrário, omitir. Ver
Audit P04/P09.

---

## 10. Copys (PT-PT)

**Bom:** já corrigido em vários sítios (estados de leads, avaliações, etc.).

**Falta (⚪):** uniformizar botões genéricos ("Guardar", "OK", "Confirmar") →
ações específicas ("Guardar alterações", "Aprovar técnico", "Emitir reembolso").
Mensagens de erro devem dizer **o que aconteceu, porquê e o que fazer**. Rever
labels de colunas, filtros, títulos de modais e estados vazios para consistência.

---

## 11. Responsividade

Desktop-first (correto). Verificar em tablet: tabelas largas (scroll horizontal
contido), drawers/modais, filtros, cabeçalhos fixos. Já há `overflow-x-auto` em
tabelas; falta política consistente e teste em <768px.

---

## 12. Acessibilidade

- Contraste: paleta parece ok; validar semânticos sobre creme/escuro.
- **Navegação por teclado + foco visível**: garantir em drawers, modais, menus,
  toggles (o novo toggle de taxas usa `role="switch"` — bom padrão a replicar).
- Não depender só de cor para estado (§7).
- Labels em inputs, ordem de leitura, `aria-*` em componentes interativos.
- Atalhos de teclado onde fizer sentido (⌘K já existe).

---

## 13. Performance

- Paginação/pesquisa/filtros **no servidor** (já acontece em `/services`); garantir
  o mesmo nas listas grandes (clientes, técnicos, pagamentos) quando forem reais.
- Skeletons (há `States`), lazy loading de páginas pesadas (Financeiro 927 linhas
  → dividir por rota reduz bundle por página), evitar carregar tudo de uma vez.
- Cache/prefetch de dados de referência (categorias, zonas).
