# Plano de Implementação — Backoffice Piquet

Sequência para reformular **sem regressões** e **sem perder dados**. Cada fase é
independente e verificável (tsc + testes + build + revisão visual). Nada aqui
está implementado ainda — aguarda aprovação (ver Regras de execução §26 do
pedido).

Coordenação: parte disto sobrepõe-se ao trabalho do Rodrigo (Laravel: taxas,
KYC, lucro, e em breve serviços/clientes/técnicos). Sincronizar via PRs.

---

## Fase 0 — Fundação segura (pré-requisitos)
- **Merge do PR atual** (`feat/backoffice-melhorias-jul26`) para o trabalho ficar durável.
- **RBAC real** (P02): definir `ROLE_PERMISSIONS` por função + página de entrada por perfil. Baixo risco, alto valor. Rodar a password partilhada e criar contas por pessoa (P14).

## Fase 1 — Correções críticas
- **Ligar Serviços ao Laravel** (P01/P05) — casca pronta; ligar quando o endpoint existir. Desbloqueia Operações e, por derivação, Clientes/Técnicos/GMV.
- **Ações de operação nos serviços**: reatribuir técnico, reagendar, cancelar (c/ motivo), reembolso, alterar estado, contactar — no drawer, com `ConfirmDialog`.
- **Perfil real do técnico** (P08) — documentos reais + aprovar/recusar no perfil.

## Fase 2 — Quick wins (alto impacto, baixo esforço)
- **Matar deltas fabricados** (P04) — deltas só com histórico real.
- **Pesquisa global de entidades** (P07) — ⌘K passa a encontrar serviço/cliente/técnico/fatura/pagamento/ticket.
- **Vistas guardadas** + **filtros persistentes** (FilterBar).
- **Unificar navegação** (P03) — acabar com aliases duplicados; redireccionamentos.

## Fase 3 — Design system
- Extrair tokens em falta (espaço/raio/sombra/densidade).
- Criar `Timeline`, `FilterBar`, `EntitySearch`, `ConfirmDialog`; evoluir `DataTable` (colunas configuráveis, seleção, ações em massa, menu "⋯").
- Catálogo único de estados/ícones (`StatusBadge` + `icons.ts`).

## Fase 4 — Nova arquitetura de informação
- Menu com grupos colapsáveis (ver IA doc).
- Dividir mega-páginas (Financeiro, Marketing) em rotas próprias — mover conteúdo dos tabs, sem reescrever.
- Redireccionamentos das rotas antigas.

## Fase 5 — Reformulação página a página
Ordem por prioridade operacional: **Painel → Serviços → Técnicos → Clientes →
Financeiro → Marketing → Suporte/Qualidade → restantes.** Para cada página:
detalhe/timeline padronizados, tabela de trabalho, filtros/vistas, ações rápidas,
estados vazios, copy PT-PT. Checklist de preservação (Data Preservation §4) por página.

## Fase 6 — Detalhe & timeline unificados
- Estrutura de detalhe única (topo + tabs + timeline) para serviço/cliente/técnico.

## Fase 7 — Centro de alertas + automações
Página de Alertas real que agrega sinais e dispara notificações. Automações
propostas:

| Problema | Regra (trigger) | Ação | Destinatário | Prioridade |
|---|---|---|---|---|
| Serviço sem técnico | estado "sem técnico" > X min | alerta + notificação | Operações | Alta |
| Serviço atrasado | agendado passou sem "em execução" | alerta | Operações | Alta |
| Pagamento pendente/falhado | estado falhou/pendente > X | alerta | Financeiro | Alta |
| Técnico por aprovar | doc "pending" há > 48h | alerta | Gestão técnicos | Média |
| Documento expirado | `expiration_date` < hoje | alerta + email técnico | Gestão técnicos | Média |
| Avaliação negativa | rating ≤ 2 | alerta | Qualidade | Média |
| Reclamação sem resposta | ticket aberto > SLA | alerta | Suporte | Alta |
| Fatura vencida | `due_date` < hoje, não paga | alerta | Financeiro | Média |
| Cron falhado | 2 falhas seguidas (`cron_runs`) | alerta | Dev | Alta |
| Relatórios periódicos | agendado | email com resumo | CEO | Baixa |

Canal real (email/WhatsApp), não só o sino (P10).

## Fase 8 — Performance, acessibilidade, responsividade, copy
- Server-side em todas as listas grandes; lazy loading por rota; skeletons.
- Foco visível, teclado, contraste, não-só-cor, `aria-*`.
- Tablet/mobile funcional.
- Revisão de copy (botões específicos, mensagens de erro acionáveis).

## Fase 9 — Melhorias futuras
- Dashboards personalizáveis por utilizador; exportações agendadas; deteção de
  anomalias; API pública de relatórios.

---

## Regras durante a execução
- Uma fase de cada vez; PR por fase; revisão do Rodrigo onde há sobreposição.
- Nunca remover dado/ação para simplificar — reorganizar via tabs/drawers/vistas.
- `tsc` + testes + build + verificação visual antes de cada merge.
- Sem ações destrutivas em produção; migrações aditivas e reversíveis.
- Preservar auditoria, financeiro e histórico.

---

## Sequência recomendada (resumo)
**0 (RBAC + merge) → 2 (quick wins) → 3 (design system) → 4 (IA) → 1/5 (ligação real + páginas, à medida que o Laravel expõe) → 6 → 7 → 8.**
As fases 0, 2, 3 e 4 **não dependem do Rodrigo** e podem avançar já; a 1 e 5
avançam à medida que os endpoints reais existem.
