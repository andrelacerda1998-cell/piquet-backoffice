/*
  Cinco estados que descrevem o que acontece mesmo:
  novo → a_procurar → com_tecnico → concluido, ou perdido.

  Os anteriores ("aguarda_resposta", "orcamento_aceite") descreviam um negócio
  de orçamentos por telefone. Neste há um passo de despacho pelo meio, e como
  nenhum estado o descrevia, atribuir um técnico escrevia "Orçamento aceite" --
  que não era verdade.

  O reembolso sai da lista: é um acontecimento financeiro, tratado no
  Financeiro, e para o pedido só interessa que não deu receita ("perdido").

  "novo" e "perdido" da primeira geração já coincidem com os nomes de agora,
  por isso não precisam de conversão.
*/
update leads set stage = 'novo'        where stage = 'nao_iniciado';
update leads set stage = 'a_procurar'  where stage in ('aguarda_resposta', 'orcamento_enviado', 'contactado');
update leads set stage = 'com_tecnico' where stage in ('orcamento_aceite', 'qualificado');
update leads set stage = 'concluido'   where stage = 'convertido';
update leads set stage = 'perdido'     where stage in ('recusado', 'reembolsado');
