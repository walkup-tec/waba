# Admin assinante — editar cadastro no modal

## Contexto
Ao abrir detalhes do assinante, master precisava editar os campos originalmente registrados.

## Solução
- `PATCH /admin/subscribers/:subscriberId` (master)
- `WabaSubscriberRepository.update` + `WabaSubscriberService.update`
- Modal com formulário editável: nome, e-mail, WhatsApp, CPF/CNPJ, senha (opcional), Aquecedor parceiro
- Botão **Salvar alterações**; histórico de compras permanece somente leitura

## Validar
Clicar assinante → alterar nome/e-mail → Salvar → lista e modal atualizados.
