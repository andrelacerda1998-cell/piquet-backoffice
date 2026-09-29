# Funcionalidades em falta

Seis. Cada uma resolve um problema que hoje se resolve por telefone, à mão ou
não se resolve.

## 1. O serviço entre "tem técnico" e "está pago"

**Problema.** Depois de atribuir um técnico, o backoffice deixa de saber o que
se passa. Não há data marcada, preço acordado, confirmação do cliente,
execução nem conclusão. Se alguém perguntar "o que está a acontecer agora na
Piquet?", não há resposta — o único ecrã que responderia mostra serviços já
fechados.

**Solução.** Estender o pedido com quatro campos — data e hora combinadas,
preço acordado, valor do técnico, estado da execução — e dois estados
intermédios: **Agendado** e **Em execução**. Não é um módulo novo: são campos
no detalhe do pedido e dois valores na lista de estados.

**Impacto.** É o que transforma o backoffice de registo em centro de
operações. Sem isto, os outros cinco pontos valem menos.

**Prioridade: P0.**

## 2. A pesquisa global tem de encontrar

**Problema.** `/api/search` procura em tabelas de Supabase que têm uma linha
cada. Um cliente ao telefone não é encontrado por nome nem por telefone.

**Solução.** Procurar onde os dados estão: clientes e técnicos no Laravel,
pedidos e pagamentos em Supabase. Aceitar telefone com e sem indicativo (a
coluna `phone9` já existe) e referência de pagamento.

**Impacto.** Suporte deixa de ser uma caça ao ecrã certo.

**Prioridade: P0.**

## 3. Ligar o pagamento ao serviço e ao cliente

**Problema.** Os 170 pagamentos do Payshop existem ao lado dos serviços, não
dentro deles. Não se consegue abrir um serviço e ver se foi pago, nem abrir um
cliente e ver o que já pagou. O GMV é um total sem detalhe navegável.

**Solução.** A ponte já existe em parte — `receita_por_cliente` liga pagamentos
a clientes do Laravel pelo `customer_ext_id`. Falta trazê-la ao detalhe do
cliente e do serviço.

**Impacto.** Responder a "este cliente pagou?" sem abrir o Payshop.

**Prioridade: P0.**

## 4. Fila de aprovação de técnicos

**Problema.** Aprovar um técnico obriga a abrir a lista, encontrar o
pendente, abrir o perfil, ir a documentos, voltar. A rede de técnicos é o
gargalo do negócio e o processo de a alargar é o mais desconfortável do
backoffice.

**Solução.** Um ecrã com a fila: dados e documentos lado a lado, três botões —
aprovar, pedir correções, recusar — e passa ao seguinte.

**Impacto.** Directo sobre o gargalo.

**Prioridade: P1.**

## 5. Saúde do despacho

**Problema.** A difusão a técnicos vai começar a produzir dados que ninguém
está a ler: quantos foram perguntados, quantos responderam, quanto tempo
demoraram, quantos pedidos ficaram sem ninguém.

**Solução.** Três números em Hoje — taxa de preenchimento, tempo mediano até
alguém aceitar, pedidos sem resposta de ninguém — e, em Técnicos → Desempenho,
a taxa de resposta por técnico.

**Impacto.** É a métrica que diz se a rede chega para a procura, que é a
pergunta central de um mercado.

**Prioridade: P1.**

## 6. Cancelamentos e reclamações num sítio

**Problema.** Um serviço que corre mal aparece disperso: motivo de perda em
Pedidos, falta do técnico em Operações, reembolso no Financeiro, reclamação em
Clientes. Não há forma de ver "o que correu mal este mês".

**Solução.** Um separador em Técnicos → Desempenho que junte faltas,
cancelamentos, reembolsos e reclamações com a data e o motivo.

**Impacto.** Torna visível o custo da qualidade, hoje invisível.

**Prioridade: P1.**

---

## Considerado e recusado

- **Mapa ao vivo dos técnicos** — bonito, sem decisão associada.
- **Notificações push do backoffice** — não há equipa para as receber.
- **Previsões e projeções** — 32 pedidos não sustentam uma previsão.
- **Relatórios automáticos** — com uma pessoa a operar, exportar de cada ecrã
  chega.
- **Gestão de disponibilidade e agenda dos técnicos** — faz sentido quando a
  rede for grande; hoje resolve-se perguntando.
