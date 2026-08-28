# Regras de Negócio

Somente regras permanentes. Sem detalhes de implementação.

## Regras

### Campanha — troca automática do número bloqueado

- Chip **vermelho** (Evolution `close`, WhatsApp `statusReason` 403, outbound quebrado ou restrição com o chip já na campanha) é substituído 1:1 pelo número livre.
- A lista de substituição é a mesma do botão «+ Instâncias». Sessão EVO `open` com banimento WhatsApp **não** conta como ativo.

### Campanha — «+ Instâncias»

- O botão inclui o número conectado livre que a tela já mostra e **substitui** o chip vermelho (bloqueado/offline).
- Não redireciona para comprar números. Compra só vale quando realmente não há spare.

### Campanha — intervalo entre mensagens

- O wait entre envios do mesmo chip é **70%** do pacing anterior (`CAMPAIGN_SEND_INTERVAL_RATIO`).
- API Alternativa (8h–22h, teto 100/dia): cerca de **168–185 s** entre mensagens do mesmo número (antes ~240–264 s).
- Teto **100 envios/dia por número** e ciclo **60 min enviando / ~14 min pausa** permanecem.

### Laboratório — identidade do card do portfólio e dos números

- Nome e foto visíveis no CARD 02 (portfólio e chips) são da conta WABA (Laboratório).
- A Meta só replica o nome do portfólio se o token for admin do Business Manager.
- A foto do Business Manager é só leitura; gravação na Meta exige Página do Facebook.
- A Meta só replica o nome do chip após aprovação do display name **e** `POST /{PHONE_NUMBER_ID}/register` com PIN. Foto e dados da empresa só entram se o número estiver Ativo.
- O card mostra o `verified_name` (coluna Name / o que o WhatsApp entrega). `new_display_name` + `new_name_status` da Graph mandam o status: Em análise, Aprovado (PIN), Recusado ou Atualizado.
- A foto do chip no card vem do cache local; URL assinada `pps.whatsapp.net` não vai no browser (expira e quebra no Gerenciador).
- Inbox do chip nasce **desligado**. Só entra no Inbox (enviar e receber) depois que o operador ligar o switch.
- O Inbox mostra o número (e o nome) dos chips com switch verde. Sem chip ligado, avisa para ligar no Laboratório.
- O nome no Inbox segue o nome salvo no Laboratório (pedido no perfil do chip). O card continua mostrando o `verified_name` da Graph até o PIN de register.
- Mensagem enviada pelo Laboratório ou recebida no webhook entra na conversa do chip ligado. O compositor do Inbox responde esse mesmo contato pela Cloud API.

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
Proibido: prefixo `**` (title ZWSP/vazio no sendButtons da Evolution).

### Campanha Alternativa — permanência do pareamento

Com a campanha em execução ou pausada, o WABA **não** desliga Proxy Brasil e **não** faz `proxy/set` nem restart nos números da campanha. Desligar proxy com a sessão ainda pareada derruba a integração (os dois números da Seguradoras). Reconectar é só no Aquecedor, pelo operador.

### Reconexão do mesmo número

Quando um número **conectar de novo** (QR / pairing):

- Tudo que existia dele na Evolution é apagado (sessão antiga e **clones** com o mesmo JID).
- Resquícios dos clones no WABA também são removidos.
- **Exceção:** quantidade de aquecimento (foguinhos) e total de mensagens enviadas do nome canônico.

### Campanha Alternativa — troca de bloqueados

- Números bloqueados/offline aparecem em vermelho na campanha.
- Com a campanha **em execução**, se houver instância **conectada** e **habilitada para disparos** fora da seleção, a troca é **automática** (1:1): o desconectado sai, o conectado entra.
- Nessa troca, a Proxy Brasil **não** faz `proxy/set` no número que entra se a sessão já está `open` (isso derruba o pareamento). O que sai da seleção pode ter proxy desligada. Números que permanecem na campanha não são tocados. Para enviar com Proxy, o operador reconecta no Aquecedor com **Proxy Campanha**.
- O botão «+ Instâncias» só aparece quando **não há** instância conectada livre (ou a campanha está pausada à espera do operador). O usuário conecta um número habilitado para disparos e então usa o botão.
- A tag «Proteção ativa» aparece quando a Proxy está confirmada nas instâncias **conectadas** da campanha.

### Campanha — disparar se a Evolution está open

- A campanha **só** pausa automaticamente quando não há o mínimo de números com `connectionState=open` (hoje 1).
- Se ao menos um número selecionado está `open`, a campanha deve **enviar**. Não pausar por cache vazio, falha de `fetchInstances` nem pela regra antiga de “50% desconectados” quando o mínimo já está cumprido.
- Pausa automática por saúde **retoma sozinha** quando o mínimo volta a `open`. Pausa manual, créditos esgotados e «parar envios» continuam pausadas.

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
