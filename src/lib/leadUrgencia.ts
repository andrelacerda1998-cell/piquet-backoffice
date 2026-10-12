/*
  A urgência de um contacto NÃO é uma coluna: vem escrita no texto, num campo
  "Urgência:" que a landing preenchia. Uma regra só para o aviso no telemóvel,
  os alertas e o ecrã dos contactos -- se divergissem, o aviso dizia urgente e
  o ecrã não, ou ao contrário.
*/
export function ehUrgente(mensagem: string): boolean {
  const campo = mensagem.match(/urg[êe]ncia:\s*([^\n·]+)/i)?.[1] ?? "";
  return /urgente|hoje|emerg|imediat|agora/i.test(campo);
}
