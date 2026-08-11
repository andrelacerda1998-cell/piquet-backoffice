# Reconciliação: `main` (Rodrigo) × `feat/backoffice-melhorias-jul26` (André)

**Para decidir antes do merge.** Preparado a 11/08/2026.

Os dois ramos divergiram no commit `2892184` ("ecrã real de revisão KYC"). Desde
aí seguiram direções **diferentes mas complementares**:

- **Rodrigo (15 commits)** — ligou o backoffice aos **dados reais do Laravel**:
  clientes, técnicos, catálogo, zonas, documentos, notificações, SMS, cobertura,
  pagamentos a vendors.
- **André (29 commits)** — trabalhou a **camada de produto e interface**: CRM de
  leads, RBAC, design-system, redesign visual, relatório mensal, KYC inline,
  honestidade dos números.

**Tentativa de merge automático: 11 ficheiros em conflito.** Este documento
lista cada sobreposição e propõe uma decisão. Nada foi merged — ambos os ramos
estão intactos.

---

## Regra geral proposta

> **Camada de dados → fica a versão do Rodrigo** (vem da produção real).
> **Camada de interface → fica a versão do André** (é a evolução do desenho).

As exceções estão assinaladas abaixo, e são só duas: **CRM de Leads** e
**Pagamentos a técnicos**, onde há genuína sobreposição funcional.

---

## 1. CRM & Leads ⚠️ *decisão de produto*

O ponto mais delicado: os dois construíram um CRM diferente, com **modelos de
dados incompatíveis**.

| | Rodrigo (`main`) | André (branch) |
|---|---|---|
| Onde vive | Página própria `/leads` | Aba dentro de `/marketing` |
| Valor | `estimated_value` (um campo) | `quote_value` + `technician_value` → **comissão automática** |
| Estados | `novo · contactado · qualificado · convertido · perdido` | `Novo · Orçamento enviado · Aceite · Executado · Recusado` |
| Categoria do serviço | — | Sim (auto da landing/mensagem) |
| Filtros | — | Pesquisa, mês, estado, categoria, origem |
| Duplicados | — | Deteção + bloqueio no servidor (30 min) |
| Métricas | — | Pipeline, comissão prevista, conversão, por responder |
| Data de receção | — | Sim, com mês por omissão |

**Recomendação: ficar com o modelo do André, na página própria do Rodrigo.**

Porquê o modelo do André: já está **em produção e a ser usado** (a tabela `leads`
tem as colunas `quote_value`, `technician_value`, `category_id`); os estados
foram escolhidos por ti para refletirem o negócio real; e o anti-duplicação já
apanhou 3 pares reais. Reverter para `estimated_value` perderia os valores já
introduzidos.

Porquê a página do Rodrigo: um CRM merece rota própria (`/leads`), não uma aba
escondida dentro de Marketing.

**Trabalho estimado:** mover o componente do André para a rota `/leads`, apagar a
versão antiga. ~1h.

---

## 2. Pagamentos a técnicos ⚠️ *decisão de produto*

| | Rodrigo | André |
|---|---|---|
| Fonte | `VendorPayments` — **API Laravel real** | Derivado dos serviços concluídos no Supabase |
| Estado | Pagamentos verdadeiros da produção | Cálculo interno (75% do valor) |

**Recomendação: ficar com a versão do Rodrigo.** São os pagamentos que a Piquet
efetivamente faz. O cálculo derivado do André servia enquanto não havia fonte
real — deixa de ser preciso.

**Atenção:** confirmar que a versão do Laravel cobre os serviços registados à mão
no backoffice (os que o André regista em Operações). Se não cobrir, ficam dois
sítios com pagamentos diferentes.

---

## 3. Clientes e Técnicos ✅ *complementar*

- **Rodrigo:** ligou ambos ao Laravel real (`CustomerController`, `VendorController`),
  incluindo suspender/reativar, métodos de pagamento, bloquear/restaurar.
- **André:** só mexeu na interface — cabeçalho novo, aviso de KYC pendente por
  técnico, remoção dos deltas fabricados, pré-visualização de documentos.

**Recomendação: ficam os dois.** Dados do Rodrigo + interface do André. Conflito
puramente textual (linhas vizinhas no mesmo ficheiro).

---

## 4. Configuração ✅ *complementar*

- **Rodrigo:** Catálogo, Categorias, Zonas, Documentos, Atividade, Notificações
  enviadas e Códigos SMS — todos reais via Laravel.
- **André:** cabeçalho de página consistente.

**Recomendação: ficam os dois.** Só é preciso reaplicar o `PageHeader` por cima
das abas novas dele.

---

## 5. Financeiro ⚠️ *verificar perdas*

O ramo do André tem funcionalidades que **não existem** no `main`:

- **Planeamento financeiro mensal** (`getBudgetItems`, `buildMonthlyPlan`) — quanto
  dinheiro é preciso por mês, com custos recorrentes e projeção a 12 meses;
- **Recorrência de faturas** (gera a seguinte quando se marca como paga);
- **Custo mensal por colaborador** a alimentar o planeamento;
- **Editar faturas e colaboradores**.

Nada disto está no `main`. **Recomendação: preservar tudo do lado do André** e
juntar o "Lucro do sistema" e "Pagamentos a vendors" do Rodrigo.

---

## 6. Resto (sem conflito real)

| Módulo | Decisão |
|---|---|
| RBAC (10 perfis), design-system, ⌘K com pesquisa de entidades | André — não existe no `main` |
| Relatório mensal por secções, Produto/downloads novos | André — idem |
| Tipografia Open Sans + escala, redesign visual dos 20 ecrãs | André — idem |
| Cobertura geográfica, SMS, notificações, auditoria | Rodrigo — não existe no branch |
| Honestidade dos números (45 deltas fabricados removidos) | André — aplicar **também** aos ecrãs novos do Rodrigo |

---

## Plano de execução sugerido

1. **Decidir** os pontos 1, 2 e 5 (são os únicos que exigem escolha humana).
2. Merge `main` → branch do André, resolvendo conforme o decidido.
3. Verificar: `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
4. Testar em produção os módulos tocados: Clientes, Técnicos, Financeiro, CRM.
5. Merge para `main` → a Vercel passa a publicar sozinha (fim dos deploys manuais).

**Estimativa:** meio-dia de trabalho depois de as decisões estarem tomadas.

---

## Perguntas para o Rodrigo

1. O `VendorPayments` do Laravel inclui os serviços registados à mão no
   backoffice, ou só os que passam pela app?
2. A tabela `leads` no Laravel/Supabase — podemos assumir as colunas
   `quote_value` / `technician_value` / `category_id` como definitivas?
3. Há alguma razão para os clientes/técnicos **não** virem do Laravel em algum
   ecrã específico?
