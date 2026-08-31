# LOG - Instâncias com foto de perfil e atualização eficiente

## Contexto
Foi solicitado exibir a foto de perfil de cada instância (WhatsApp) e garantir atualização quando o usuário trocar a imagem no WhatsApp.

## Solução implementada
1. Backend (`src/index.ts`)
   - Incluído no retorno de `GET /instancias`:
     - `profilePicUrl`
     - `avatarVersion` (baseado em `updatedAt`)
   - Mantidos também:
     - `displayName`, `number`, `contacts`, `messages`, `connectionStatus`
   - Correção de mapeamento dos contadores nativos da EVO:
     - contatos: `_count.Contact`
     - mensagens: `_count.Message`

2. Frontend (`index.html`)
   - Na tabela de Instâncias:
     - renderiza `<img>` real de avatar quando existir `profilePicUrl`
     - fallback para ícone circular quando não houver foto
   - Estratégia eficiente de atualização:
     - `src = profilePicUrl + ?v=avatarVersion`
     - assim a imagem só quebra cache quando a EVO atualizar `updatedAt`
     - evita recargas desnecessárias de avatar em toda atualização.

## Validação
- `GET /instancias` validado com sucesso contendo:
  - `profilePicUrl`
  - `avatarVersion`
  - `contacts/messages` populados corretamente

## Arquivos alterados
- `src/index.ts`
- `index.html`
- `dist/index.html` (via build)
- `dist/index.js` (via build)

## Keywords
- profilePicUrl
- avatarVersion
- cache-busting
- _count.Contact
- _count.Message

