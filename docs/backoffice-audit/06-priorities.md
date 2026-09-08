# Prioridades

## P0 — essencial

| # | Alteração | Porquê |
|---|---|---|
| 1 | **Continuidade do serviço**: agendamento, preço e execução no pedido; estados Agendado e Em execução | Sem isto o backoffice não sabe o que está a acontecer hoje |
| 2 | **Hoje**: fundir Visão Geral e Alertas, com "Requer atenção" no topo | Abrir e perceber em 30 segundos |
| 3 | **Corrigir o selo de demonstração**: 13 endpoints reais marcados como demo | Um selo que erra destrói a confiança em todos os números |
| 4 | **Pesquisa global sobre dados reais** (Laravel + pedidos, por telefone e NIF) | Suporte ao telefone |
| 5 | **Ligar pagamentos a clientes e serviços** | Saber quem pagou sem abrir o Payshop |
| 6 | **Tirar os dados de exemplo dos ecrãs de produção** (Push, Qualidade, Pedidos personalizados) | Números inventados ao lado de números reais |

## P1 — importante

| # | Alteração |
|---|---|
| 7 | Reduzir o menu de 14 para 6 áreas |
| 8 | Financeiro → Dinheiro: 23 KPIs para 6 no resumo, cinco separadores |
| 9 | Fila de aprovação de técnicos num só ecrã |
| 10 | Fundir Operações em Pedidos |
| 11 | Qualidade → Técnicos → Desempenho |
| 12 | Métricas de despacho (preenchimento, tempo até aceitar) |
| 13 | Cancelamentos e reclamações num sítio |
| 14 | Remover Equipa, Desenvolvimento, Tarefas, Recrutamento, Objetivos, Relatórios |
| 15 | Cronologia visual no detalhe do pedido |
| 16 | Histórico completo no detalhe do cliente |
| 17 | Zonas geográficas dos técnicos (exige mudança no Laravel) |

## P2 — pode esperar

| # | Alteração |
|---|---|
| 18 | Definições: juntar registos técnicos num separador |
| 19 | Remover Bugs e Logs do Produto |
| 20 | Decidir o futuro do Suporte (0 tickets) |
| 21 | Apagar as tabelas `_seed_backup_*` |
| 22 | Uniformizar cores de estado em todo o backoffice |
| 23 | Reduzir os 15 estados de serviço aos que são realmente escritos |

## Cores dos estados — proposta única

| Cor | Significado | Onde |
|---|---|---|
| Cinzento | Novo, por começar, inativo | Novo · Por aprovar |
| Azul | A decorrer, à espera de terceiros | À procura de técnico · Em execução · Agendado |
| Âmbar | À nossa espera, requer acção | Técnico aceitou · Documento por aprovar · Fatura vencida |
| Verde | Concluído, pago, aprovado | Concluído · Pago · Ativo |
| Vermelho | Falhou, cancelado, problema | Perdido · Pagamento recusado · Reclamação |

Cinco cores, um significado cada. Hoje há tons de aviso usados tanto para "está
a decorrer" como para "precisa de ti", que são coisas opostas.
