# Contexto do pedido

Usuário compartilhou um link do Google Drive com a logo oficial da Drax e solicitou que a logo fosse colocada no repositório para renderizar corretamente em qualquer ambiente (local e nuvem).

# Comandos e ações executadas

1. Verificação da raiz do projeto:
   - `ls`
2. Download da logo oficial para o repositório:
   - `Invoke-WebRequest -Uri "https://drive.google.com/uc?export=download&id=1R9R6e6zbpGODNt9SkHMBMIJ5fXg9QlGs" -OutFile "D:/Waba/media/Drax-logo-footer.png"`
3. Validação do arquivo baixado:
   - `ls D:/Waba/media`
4. Atualização das referências da logo no frontend (`index.html`) para caminho local versionado:
   - de `https://draxsistemas.com.br/assets/media/Drax-logo-footer.png`
   - para `/media/Drax-logo-footer.png`
5. Build da aplicação para atualizar `dist/`:
   - `npm run build`
6. Validação da cópia da logo no build:
   - `ls D:/Waba/dist/media`

# Solução implementada (passo a passo)

1. A logo foi adicionada em `media/Drax-logo-footer.png` dentro do projeto.
2. O `index.html` foi ajustado para usar o caminho local versionado (`/media/Drax-logo-footer.png`) no favicon e na imagem principal.
3. Foi executado `npm run build` para garantir a propagação para `dist/media/Drax-logo-footer.png`.
4. Confirmada a presença do arquivo no diretório de build.

# Arquivos criados/alterados

- `media/Drax-logo-footer.png` (novo)
- `index.html` (alterado)
- `doc/LOG-2026-03-27__113541__update-logo-drax-local-git-path.md` (novo)

# Como validar

1. Iniciar a aplicação (`npm start`).
2. Abrir a interface e verificar:
   - favicon no navegador;
   - logo Drax no topo da aplicação.
3. Confirmar no DevTools que a imagem carrega de:
   - `/media/Drax-logo-footer.png`
4. Conferir também no build:
   - `dist/media/Drax-logo-footer.png`

# Observações de segurança

- Nenhum segredo/chave foi exposto.
- A integração foi feita com asset local no repositório, removendo dependência de domínio externo para exibição da logo.

# Itens para evitar duplicação no futuro (palavras-chave)

- logo-drax
- media-local
- favicon-local
- google-drive-asset
- renderizacao-local-nuvem
