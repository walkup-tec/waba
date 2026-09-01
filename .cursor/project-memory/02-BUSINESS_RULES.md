# Regras de Negócio

Somente regras permanentes. Sem detalhes de implementação.

## Regras

### Notificação WhatsApp — transferência de campanha

- Transferir campanha notifica o operacional que recebeu e os masters **uma vez por número WhatsApp**.
- Vários cadastros master no mesmo telefone não geram cópias. O texto de transferência não reutiliza o aviso de «nova campanha».

### Campanha — troca automática do número bloqueado

- Chip **vermelho e apto à troca 1:1** quando não dá para enviar: Evolution `close` / `connecting`, probe live vazio sobre instância já `close` no fetchInstances, WhatsApp `statusReason` 403, HTTP 403 no envio, outbound `MessageUpdate=ERROR`, tag **Restrição**, ou pausa `restricted_wait`.
- Só `connectionState=open` **com Proxy Brasil ligada** conta como ativo para disparo. Timeout do probe **não** pinta de verde quem o fetchInstances já marcou desconectado.

### Campanha — «+ Instâncias»

- O botão **substitui** o chip vermelho (bloqueado/offline): o vermelho **sai** da campanha e fica desativado no disparador; o substituto entra no mesmo slot.
- A campanha **não passa** da quantidade configurada (ex.: 4 números → no máximo 4).
- Só entra substituto `open` **com Proxy Brasil ligada**. Toda instância que permanece na campanha precisa de Proxy Brasil para disparar.
- Não redireciona para comprar números. Compra só vale quando realmente não há spare com Proxy.

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
- Assistente de templates Utility exige selecionar o portfólio/WABA e informar
  um texto base. Quando elegível, gera três versões para escolha e revisão humana.
- Após confirmação humana, as três opções são cadastradas como templates
  distintos e acompanhadas individualmente até aprovação/rejeição pela Meta.
- A IA não envia templates automaticamente nem garante aprovação. Se a finalidade
  central for Marketing, não deve convertê-la artificialmente em Utility.
- O nome no Inbox segue o nome salvo no Laboratório (pedido no perfil do chip). O card continua mostrando o `verified_name` da Graph até o PIN de register.
- Mensagem enviada pelo Laboratório ou recebida no webhook entra na conversa do chip ligado. O compositor do Inbox responde esse mesmo contato pela Cloud API.
- O Inbox lista o fio pelo tenant e pelos chips ligados, não só pela conexão Meta mais recente.
- O mesmo contato mantém um fio separado para cada número oficial receptor:
  `tenant_id + phone_number_id + contact_wa_id`. Mensagens enviadas à Drax não
  podem aparecer na conversa da Walkup, e vice-versa.

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
- Nessa troca, a Proxy Brasil **não** faz `proxy/set` no número que entra se a sessão já está `open` (isso derruba o pareamento). O que sai da seleção pode ter proxy desligada. Números que permanecem na campanha não são tocados.
- Instância que entra `open` **sem** Proxy Brasil **não dispara** até o operador reconectar no Aquecedor com **Proxy Campanha**.
- O botão «+ Instâncias» só aparece quando **não há** instância conectada livre (ou a campanha está pausada à espera do operador). O usuário conecta um número habilitado para disparos e então usa o botão.
- A tag «Proteção ativa» aparece quando a Proxy está confirmada nas instâncias **conectadas** da campanha.

### Campanha — disparar só com open e Proxy Brasil

- A campanha **só** dispara em instância selecionada com `connectionState=open` **e** `/proxy/find` enabled.
- Sem Proxy Brasil, o chip `open` **não** é ativo para envio. A campanha pausa se nenhuma selecionada estiver open com Proxy; retoma sozinha quando isso volta.
- Timeout do probe **não** pinta de verde quem o fetchInstances já marcou desconectado.
- Pausa manual, créditos esgotados e «parar envios» continuam pausadas.

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
