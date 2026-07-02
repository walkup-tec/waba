# Máscaras CPF/CNPJ e WhatsApp — cadastro assinante (admin)

## Pedido
Aplicar máscara nos campos CPF/CNPJ e WhatsApp do formulário **Novo assinante** (Admin · Assinantes).

## Solução
- `formatAdminCpfCnpjInput` — CPF `000.000.000-00` até 11 dígitos; CNPJ `00.000.000/0000-00` até 14
- WhatsApp reutiliza `formatWhatsappTarget` — `(XX) XXXXX-XXXX`
- `bindAdminSubscriberMaskedInputs()` no `initAdminSubscribersUi`
- Submit envia só dígitos; validação de 11 dígitos celular (9 na 3ª posição) e CPF/CNPJ 11 ou 14

## Arquivos
- `index.html`, `dist/index.html`

## Validar
Admin · Assinantes → digitar números nos campos → máscara aplica em tempo real; criar assinante com dados válidos.
