/*
  A ponte entre um pedido feito na app e o pedido no backoffice.

  Os clientes pedem na app; o pedido fica no Laravel. Sem esta coluna, cada
  sincronização criaria linhas novas em vez de actualizar as que já existem --
  e o mesmo pedido apareceria dez vezes na lista.

  Texto e não inteiro: o id é do Laravel, não desta base de dados, e fingir uma
  chave estrangeira para uma tabela que não existe aqui seria mentira.
*/
alter table leads add column if not exists laravel_service_id text;

create unique index if not exists leads_laravel_service_id
  on leads (laravel_service_id) where laravel_service_id is not null;
