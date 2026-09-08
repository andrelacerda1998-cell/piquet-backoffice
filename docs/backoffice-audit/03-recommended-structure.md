# Estrutura recomendada

## Princípio

Seis áreas, uma por pergunta que alguém faz ao abrir o backoffice:

| Área | Pergunta |
|---|---|
| **Hoje** | O que precisa de mim agora? |
| **Pedidos** | Quem pediu, e em que ponto está? |
| **Técnicos** | Quem trabalha connosco, e quem está a entrar? |
| **Clientes** | Quem é esta pessoa e o que já fizemos por ela? |
| **Dinheiro** | Entrou quanto, saiu quanto, falta quanto? |
| **Crescimento** | De onde vêm os pedidos e a que custo? |

Definições fica no fundo da barra, separada — não é uma área de trabalho.

## Hoje

Substitui a Visão Geral e os Alertas. Abre por omissão.

**Requer atenção** (primeiro, sempre; cada linha abre onde se resolve)
- N pedidos sem ninguém contactado
- N técnicos aceitaram e esperam decisão
- N pedidos sem resposta há mais de um dia
- N documentos de técnicos por aprovar
- N pagamentos recusados
- N faturas ou impostos vencidos
- N integrações paradas

**O dia** — pedidos entrados hoje · serviços a decorrer · concluídos hoje ·
cobrado hoje.

**O mês** — GMV · comissão Piquet · serviços concluídos · ticket médio · taxa
de preenchimento (pedidos que arranjaram técnico) · tempo mediano até alguém
aceitar.

Doze números no total, nenhum repetido noutro sítio do ecrã. O ano vive em
Dinheiro.

## Pedidos

Um só ecrã para todo o ciclo, com filtro de estado.

**Estados:** Novo · À procura de técnico · Com técnico · Concluído · Perdido.

**Lista:** cliente · serviço · cidade · urgência · estado · há quanto tempo ·
valor. Sete colunas.

**Filtros visíveis:** estado, mês. **Mais filtros:** categoria, origem, cidade.
Pesquisa por nome, telefone ou texto do pedido.

**Detalhe** — o pedido, a conversa de WhatsApp, o painel de técnicos e a
**cronologia**: entrou → perguntado a N → aceitaram N → atribuído a X →
agendado → concluído → pago.

## Técnicos

**Separadores:** Lista · Por aprovar · Desempenho.

**Lista:** nome · categorias · cidade · estado · serviços · avaliação · última
atividade. **Filtros:** estado, categoria, cidade.

**Por aprovar** — fila de aprovação num ecrã só: documentos ao lado dos dados,
aprovar/pedir correções/recusar sem navegar.

**Desempenho** — absorve a Qualidade: avaliação, taxa de aceitação, faltas,
cancelamentos.

## Clientes

**Lista:** cliente · contacto · cidade · nº de serviços · total gasto · último
serviço · estado.

**Detalhe:** dados, moradas, histórico de serviços, pagamentos, avaliações,
reclamações, notas internas.

## Dinheiro

**Separadores:** Resumo · Pagamentos · A pagar · Custos · Fiscal.

- **Resumo** — GMV, comissão, ticket médio, por categoria; mês e ano.
- **Pagamentos** — Payshop: cobrados, cativos, recusados, reembolsos.
- **A pagar** — o que se deve aos técnicos e o estado de cada pagamento.
- **Custos** — faturas de fornecedores e orçamento.
- **Fiscal** — IVA, obrigações, colaboradores. Absorve `/impostos-rh`.

## Crescimento

**Separadores:** Campanhas · Origem dos pedidos · Apps.

- **Campanhas** — Meta e Google: investimento, pedidos, clientes, CAC, ROAS.
- **Origem dos pedidos** — por canal, com receita real atribuída.
- **Apps** — downloads, avaliações, funil.

Sai: Push, códigos de desconto, guiões, bugs, logs.

## Definições

Catálogo e preços · Zonas · Documentos exigidos · Integrações e chaves ·
Acessos.

## O que desaparece

Alertas (passa a ser o topo de Hoje) · Qualidade (separador em Técnicos) ·
Suporte (caixa dentro de Hoje) · Equipa · Desenvolvimento · Tarefas ·
Recrutamento · Objetivos · Relatórios · Impostos e RH (separador em Dinheiro) ·
Pedidos personalizados (filtro em Pedidos) · Produto (parte para Crescimento,
parte para Definições).

**De 14 entradas de menu para 6.**
