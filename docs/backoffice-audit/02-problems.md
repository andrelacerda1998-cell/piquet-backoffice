# Problemas, redundâncias e fricção

## O problema de fundo

O backoffice foi construído como **sistema de gestão de uma empresa** — RH,
impostos, orçamento, chat interno, tarefas, recrutamento, relatórios, objetivos.
A Piquet, hoje, é **um mercado com um único ciclo operacional**:

> pedido → encontrar técnico → executar → cobrar

Os ecrãs que servem esse ciclo são uma minoria da superfície, e vários dos que
o cercam mostram dados de exemplo. O resultado é um produto onde a coisa mais
importante do negócio ocupa menos espaço do que a menos importante.

Duas medidas do desequilíbrio: há **55 tarefas de desenvolvimento** registadas
e **0 tickets de suporte**; há **23 KPIs no Financeiro** e **nenhum ecrã que
mostre um serviço a decorrer**.

## P0 — o que trava a operação

### 1. O ciclo parte-se a meio
Um pedido percorre Novo → À procura de técnico → Com técnico. Depois disso, o
backoffice não sabe mais nada: não há data marcada, preço acordado, execução
nem conclusão. O pedido só volta a existir quando alguém o marca como
"Concluído", o que exige já ter o valor cobrado e o valor do técnico.

Entre "o técnico aceitou" e "está pago" — que é onde o serviço acontece — o
sistema está cego. Combina-se por telefone e escreve-se no fim.

### 2. Os serviços e os pedidos são dois mundos sem ponte
`Operações` lê serviços do Laravel. `Pedidos` lê leads de Supabase. Um pedido
que vira serviço cria uma linha nova, sem ligação de volta. Não se consegue
responder a "este serviço veio de que campanha?" nem a "este pedido deu em
quê?" sem cruzar à mão.

### 3. A pesquisa global não encontra nada
`/api/search` procura em `services`, `customers` e `technicians` de Supabase —
tabelas com **1 linha cada**. Os dados reais estão no Laravel. Quem usa a
pesquisa para resolver um caso de suporte não encontra o cliente que tem ao
telefone.

### 4. A mesma tabela com dois selos diferentes
Sete gráficos do Financeiro e da Visão Geral derivam de `services`, que está
marcado como real desde que o seed foi apagado — e mostravam "Demo". A lista
era real e o gráfico feito a partir dela dizia que era ficção.

**Correcção da primeira versão desta auditoria:** aqui dizia-se que eram 13
endpoints e que o selo mentia. Estava errado por má leitura do que o selo
significa — não é "chama o servidor", é "não é ficção". `/finance/summary` e os
três de impostos somam `tax_obligations`, que tem 27 linhas escritas todas no
mesmo dia por um seed: nesses, o selo está certo e fica.

### 5. Dados de exemplo em ecrãs de produção
Qualidade, Pedidos personalizados, partes de Técnicos e Clientes e o separador
Push do Marketing mostram dados gerados. O Push chega a inventar métricas de
entrega com `Math.random()` — um ecrã que reporta resultados de campanhas que
nunca saíram da máquina.

## P1 — o que faz perder tempo

### 6. Informação a competir consigo própria
23 KPIs no Financeiro, 14 na Qualidade, 13 nos Técnicos, 12 na Visão Geral.
Nenhum deles está errado; juntos não deixam ver nenhum. O ecrã de Visão Geral
mostra GMV do mês e do ano, comissão do mês e do ano, serviços executados e
agendados do mês e do ano — oito números para duas perguntas.

### 7. Sete ecrãs escondidos
`/tarefas`, `/objetivos`, `/relatorios`, `/servicos-personalizados`,
`/recrutamento`, `/impostos-rh` e o antigo despacho só se alcançam por ⌘K ou
por URL. Ou merecem estar no menu, ou não deviam existir.

### 8. Módulos de empresa dentro de um backoffice de operação
Chat interno, agenda de reuniões, tarefas de equipa, tarefas pessoais,
recrutamento, colaboradores e simulador salarial. São ferramentas de uma
empresa com equipa; a Piquet opera com uma pessoa e ferramentas que já existem
fora daqui.

### 9. Estados dos serviços em excesso
O tipo `ServiceStatus` tem 15 estados: `pedido_recebido`, `a_procurar_tecnico`,
`tecnico_encontrado`, `a_aguardar_orcamento`, `orcamento_enviado`,
`a_aguardar_pagamento`, `pago`, `agendado`, `em_execucao`, `concluido`,
`cancelado_cliente`, `cancelado_tecnico`, `sem_tecnico_disponivel`,
`reembolsado`, `em_reclamacao`. Vários nunca são escritos por código nenhum.

## Redundâncias encontradas

| # | Redundância | Recomendação |
|---|---|---|
| 1 | **Duas listas de pedidos**: `Pedidos` e `Operações → Pedidos personalizados` | Fundir em Pedidos, com filtro |
| 2 | **Três sítios com tarefas**: `/tarefas` (pessoal), `Equipa → Tarefas`, `/desenvolvimento` | Sair do backoffice |
| 3 | **Impostos e RH em dois sítios**: separador do Financeiro e ecrã `/impostos-rh` | Um só, dentro de Dinheiro |
| 4 | **Métricas de técnicos repetidas** em Técnicos → Visão geral e em Qualidade | Fundir em Técnicos |
| 5 | **Clientes: quatro filtros de estado** (Todos, Bloqueados, Podem pedir, Não podem) para dois estados reais | Um filtro com dois valores |
| 6 | **GMV e comissão em mês e ano** na Visão Geral e outra vez no Financeiro | Mês na Visão Geral, o resto no Dinheiro |
| 7 | **Relatórios** repete o que os ecrãs já mostram | Remover; exportar de cada ecrã |
| 8 | **Reservas da app** (Express) e **Serviços** (Laravel) lado a lado | Decidir qual é a fonte |
| 9 | **Objetivos** e **Visão Geral** mostram a mesma progressão anual | Uma linha na Visão Geral |
| 10 | `_seed_backup_*` — 4 tabelas de sementes na base de produção | Apagar |

## Confuso

- **"Operações"** no menu abre serviços; **"Pedidos"** abre leads. Os nomes não
  dizem qual é qual, e ambos são pedidos de serviço em momentos diferentes.
- **"Lucro do sistema"** — separador do Financeiro cujo nome não diz de quem é
  o lucro nem de que sistema.
- **"AT validada" / "AT por validar"** — linguagem interna do Portal das
  Finanças à mistura com filtros de negócio.
- **Reembolsado** deixou de ser estado de um pedido mas continua a ser estado
  de um serviço, com significados diferentes nos dois sítios.

## O que devia ser removido

Por ordem de convicção: separador **Push** do Marketing (inventa métricas),
**Relatórios**, **Objetivos**, **/tarefas**, **Equipa** (chat, agenda,
tarefas), **Desenvolvimento**, **Recrutamento**, **Qualidade** como ecrã
próprio (passa a separador em Técnicos), **Pedidos personalizados** como ecrã
próprio, tabelas `_seed_backup_*`.

Isto retira 7 entradas de menu e cerca de 6 000 linhas de código sem tocar em
nada que a operação use hoje.
