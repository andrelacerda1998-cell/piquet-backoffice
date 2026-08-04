# Arquitetura de Informação — Backoffice Piquet

## 1. Navegação atual

**Menu principal (11):** Visão Geral (`/`), Operações (`/servicos`), Clientes,
Técnicos, Financeiro, Produto, Marketing, Equipa (`/chat`), Desenvolvimento,
Tarefas, Configurações.

**Entradas "secundárias" — quase todas aliases `?tab=` de outras páginas:**
Pedidos personalizados (`/servicos?tab=personalizados`), Qualidade
(`/servicos?tab=qualidade`), Suporte (`/clientes?tab=suporte`), Recrutamento
(`/tecnicos?tab=recrutamento`), Impostos e RH (`/financeiro?tab=impostos`),
Tarefas e equipa (`/chat?tab=tarefas`), Despacho ao vivo (`/despacho`),
Alertas (`/alertas`).

### Problemas de IA

1. **Duplicação página ↔ alias.** Existem páginas próprias (`/suporte`,
   `/qualidade`, `/recrutamento`, `/impostos-rh`, `/servicos-personalizados`)
   **e** aliases que apontam para tabs dentro de outra página. O mesmo módulo
   tem duas "casas" — o utilizador nunca sabe qual é a canónica.
2. **Sobrecarga de páginas grandes.** `Financeiro` (927 linhas) junta Resumo,
   Pagamentos da app, Custos, Planeamento, Pagamentos a técnicos, Impostos/RH e
   Lucro do sistema. `Marketing` junta aquisição + CRM + push + códigos.
3. **Nomenclatura inconsistente.** "Operações" aponta para `/servicos`;
   "Equipa" aponta para `/chat`. O rótulo e a rota não coincidem.
4. **Módulos operacionais escondidos.** Suporte, Qualidade, Despacho e Alertas
   — centrais numa operação de marketplace — estão como secundários/demo.
5. **Sem separação por domínio.** Aquisição (Marketing) e Produto (analytics)
   vivem separados de um "Analytics" coeso; Faturação está dentro de Financeiro
   sem destaque próprio.

---

## 2. Princípios da nova IA

- **Uma casa por módulo.** Cada funcionalidade tem uma rota canónica; nada de
  aliases que dupliquem. Deep-links `?tab=` continuam a existir (para
  notificações), mas o menu aponta sempre para a casa canónica.
- **Agrupar por domínio operacional**, não por ecrã.
- **Progressive disclosure:** o menu mostra os módulos; o detalhe fino vive em
  tabs, drawers e vistas — nunca se perde, só se hierarquiza.
- **Preparado para RBAC:** cada grupo/módulo mapeia a permissões, para o menu se
  adaptar ao perfil (ver `BACKOFFICE_DATA_PRESERVATION.md` §Permissões).

---

## 3. Nova arquitetura proposta

Menu lateral com **grupos colapsáveis** (secções), cada um com módulos:

```
▸ VISÃO GERAL
    · Painel                     /                (centro de controlo, tempo real)

▸ OPERAÇÃO
    · Serviços                   /servicos        (reservas + estados + detalhe)
    · Despacho ao vivo           /servicos/despacho
    · Pedidos personalizados     /servicos/personalizados
    · Qualidade                  /operacao/qualidade  (avaliações, reclamações, incidentes)
    · Suporte                    /suporte         (inbox de tickets)

▸ PESSOAS
    · Clientes                   /clientes
    · Técnicos                   /tecnicos        (perfil + KYC/aprovações)
    · Recrutamento               /tecnicos/recrutamento

▸ FINANCEIRO
    · Resumo financeiro          /financeiro
    · Pagamentos (app)           /financeiro/pagamentos-app
    · Pagamentos a técnicos      /financeiro/payouts
    · Custos e faturas           /financeiro/custos
    · Planeamento                /financeiro/planeamento
    · Lucro do sistema           /financeiro/lucro
    · Impostos e RH              /financeiro/impostos

▸ CRESCIMENTO
    · Marketing & Aquisição      /marketing       (Meta, canais, CAC, ROAS)
    · CRM & Leads                /marketing/crm
    · Produto & Analytics        /produto         (downloads, funil Mixpanel, integrações)
    · Objetivos                  /objetivos

▸ EQUIPA & FERRAMENTAS
    · Chat da equipa             /chat
    · Tarefas (pessoal)          /tarefas
    · Desenvolvimento            /desenvolvimento
    · Relatórios                 /relatorios

▸ SISTEMA
    · Alertas                    /alertas         (feed real acionável)
    · Integrações                /configuracao/integracoes
    · Configurações              /configuracao    (catálogo, preços, zonas, taxas, documentos)
    · Administração              /configuracao/admin  (utilizadores, permissões, auditoria)
```

Notas:
- Mantém-se **tudo** o que existe hoje — só se reorganiza e se elimina a
  duplicação página/alias (a "casa" canónica passa a ser única).
- `Financeiro` deixa de ser um mega-ecrã de 7 tabs: cada tab passa a módulo
  próprio no grupo Financeiro (as sub-abas atuais viram rotas). O conteúdo é o
  mesmo; só ganha uma casa e um URL direto.
- O grupo **Sistema** separa claramente o que é operação do que é
  administração/configuração (importante para RBAC).

---

## 4. Barra superior (persistente, em todas as páginas)

- **Pesquisa global de entidades** (⌘K) — serviços, clientes, técnicos,
  faturas, pagamentos, tickets (ver `BACKOFFICE_UX_UI_AUDIT.md` §Pesquisa).
- **Seletor de período global** (já existe) + filtros.
- **Notificações** (sino) + centro de alertas.
- **Perfil/conta** + troca de tema.

---

## 5. Mapa de redireccionamentos (sem quebrar links)

Para não partir bookmarks/links existentes, cada rota antiga redireciona para a
canónica nova:

| Antigo | Novo |
|---|---|
| `/suporte` e `/clientes?tab=suporte` | `/suporte` (canónica) |
| `/qualidade` e `/servicos?tab=qualidade` | `/operacao/qualidade` |
| `/recrutamento` e `/tecnicos?tab=recrutamento` | `/tecnicos/recrutamento` |
| `/servicos-personalizados` e `/servicos?tab=personalizados` | `/servicos/personalizados` |
| `/impostos-rh` e `/financeiro?tab=impostos` | `/financeiro/impostos` |
| `/despacho` | `/servicos/despacho` |

(Implementação: `redirect()` nas rotas antigas — nada de conteúdo perdido.)

---

## 6. Impacto no código

- **Baixo risco:** a maior parte é reorganizar `NAV` em `config/dashboard.ts` +
  `Sidebar.tsx` (grupos colapsáveis) e dividir 2–3 mega-páginas (Financeiro,
  Marketing) em rotas — o conteúdo dos tabs move-se sem reescrever.
- **Reaproveita** `Tabs`/`SubTabs` existentes.
- Deve ser feito **depois** do design system e **antes** da reformulação
  página-a-página (ver plano).
