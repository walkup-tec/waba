# Regras de Negócio

Somente regras permanentes. Sem detalhes de implementação.

## Regras

### Crédito mínimo no checkout PIX (Disparos)

- API Alternativa: mínimo **R$ 200,00** (pacote de 1.000 envios).
- API Oficial: mínimo **R$ 300,00** (pacote de 1.000 envios é R$ 320,00).
- Os mínimos são independentes (`WABA_DISPAROS_MIN_CREDIT_CENTS` vs `WABA_DISPAROS_MIN_CREDIT_CENTS_ALTERNATIVA`).

### Boas-vindas WhatsApp (obrigatória)

- A mensagem de boas-vindas **é obrigada a chegar no WhatsApp do assinante, sem exceção** (cadastro e reenvio).
- Fila de origem: `51981077770` → `51997462102` → `51981082477`. Ausente/desconectado usa o **próximo**. Se a fila falhar, usa qualquer instância Evolution `open`.
- Envia no JID canônico confirmado pela Evolution (`exists:true`), não só no número digitado.
- Só conta entregue com ACK de aparelho (`DELIVERY_ACK` / `READ` / `PLAYED`). Retry em background até sucesso.
- O texto não usa traços de caixa (`━`): no iPhone eles cortam a bolha. A arte de boas-vindas é imagem JPEG, não preview de link.

### Reenvio de boas-vindas (assinante)

- O master pode reenviar e-mail e WhatsApp de boas-vindas pelo Admin · Assinantes.
- **Não** se pede nem se exige a senha do assinante no reenvio.
- A senha em plaintext **não** é armazenada; no reenvio a mensagem usa fallback orientando a senha do cadastro / “Esqueci a senha”.
- Canais do reenvio: e-mail + WhatsApp (Evolution), pelos canais já configurados para boas-vindas.

### Campanha Alternativa — formato da mensagem (API Alternativa)

Ordem obrigatória no WhatsApp:

1. Imagem da campanha (1080×1080)
2. Texto da campanha **sem URL** e **sem preview** de link
3. Botão nativo com a URL curta (destino só no botão)

Proibido: card de preview antes do texto; “Mais informações: https://…” no corpo.

### Campanha Alternativa — permanência do pareamento

Com a campanha em execução ou pausada, o WABA **não** desliga Proxy Brasil e **não** faz `proxy/set` nem restart nos números da campanha. Desligar proxy com a sessão ainda pareada derruba a integração (os dois números da Seguradoras). Reconectar é só no Aquecedor, pelo operador.

### Campanha Alternativa — troca de bloqueados

- Números bloqueados/offline aparecem em vermelho na campanha.
- Com a campanha **em execução**, se houver instância **conectada** e **habilitada para disparos** fora da seleção, a troca é **automática** (1:1): o desconectado sai, o conectado entra.
- Nessa troca, a Proxy Brasil **desliga** no número que sai e **liga** no número que entra. Não se desliga Proxy nos números que permanecem na campanha.
- O botão «+ Instâncias» só aparece quando **não há** instância conectada livre (ou a campanha está pausada à espera do operador). O usuário conecta um número habilitado para disparos e então usa o botão.
- A tag «Proteção ativa» aparece quando a Proxy está confirmada nas instâncias **conectadas** da campanha.

### Boas-vindas WhatsApp vs aquecedor

- A mensagem de boas-vindas WhatsApp (cadastro e reenvio) **deve ser enviada** mesmo se a instância de origem estiver em **Preparando** ou **3 horas pausa humana**.
- Lifecycle do aquecedor (Preparando / pausa humana / cota diária) aplica-se a aquecedor e campanhas Alternativa — **não** bloqueia boas-vindas.
- Boas-vindas é envio crítico: retry até sucesso quando a falha for transitória / instância temporariamente offline.

### Owners excluídos de métricas e split

Campanhas e pedidos dos e-mails abaixo **não** entram na contabilização de:

- Dashboard do menu Admin
- Split / Financeiro (settlements e product metrics)
- Indicadores do Dashboard do menu Disparos (visão consolidada master)

E-mails:

- `mozart.pmo@gmail.com`
- `quantumivst@gmail.com`
- `walkup@walkuptec.com.br`

Lista no código: `src/billing/waba-metrics-excluded-owners.ts`. Settlements já gravados desses owners são removidos no load do Financeiro/Admin.

### Campanhas de bônus de envio e split

Campanhas geradas com crédito de **Bônus de envio** (admin) **não** entram no split de pagamento ao fornecedor: não há receita do cliente, então não há repasse.

- Na geração da campanha grava-se `creditFunding` (`fromPaid` / `fromBonus`).
- Campanha 100% bônus → sem settlement PIX do fornecedor.
- Campanha mista → repasse só sobre a parcela paga (`min(enviados, fromPaid)`).
- Pedidos com `grantSource: admin-bonus-envios` também não geram settlement de pedido.
- Settlements indevidos de campanhas 100% bônus (com funding gravado) são removidos no load do Financeiro/Admin.
- **Fila legada (2026-08-04):** campanhas `generated`/`in_progress` sem `creditFunding` são marcadas como 100% bônus (backfill no operacional/financeiro e na finalização).

### Operacional com múltiplos tipos de disparo

- No cadastro de usuários, o operacional pode atender **um ou mais** planos (API Oficial e/ou API Alternativa) via seleção múltipla.
- No Financeiro · Split, o mesmo operacional pode ser cadastrado **uma vez por combinação** de tipo de disparo + segmento, com custo/PIX distintos (necessário para o split).
- Unicidade do fornecedor: `e-mail + apiKind + segment`.
- Segmento do fornecedor no split é escolhido no formulário (Bets/Outros), não apenas herdado do cadastro de usuário.

### Dispositivos — integração com o Aquecedor (lingueta)

- Após cadastrar o número WhatsApp no dispositivo virtual, o usuário vê a lingueta **«Adicionar ao Aquecedor»** — a integração **não** inicia automaticamente.
- Um clique na lingueta dispara a integração (instância + aquecedor) **sem** etapa CONFIRMAR nem botão **Aquecer** na barra.
- Durante a integração: lingueta **«Aguarde um instante...»** (não clicável).
- Após a instância aparecer em **Instâncias**: lingueta **«Integração Finalizada»** e menu **Instâncias** pulsa até o usuário abrir essa aba.
- Textos visíveis ao usuário no fluxo Dispositivos **não** mencionam EVO/Evolution; preferir **dispositivo** em vez de *device*.

### Ambientes

- Publicação permitida apenas em **Produção** (`master`).
- V02 e V03 existem só como localhost.
