# Contexto do pedido

Usuário aprovou o layout e solicitou troca dos ícones do menu lateral:
- Dashboard: gráfico/indicadores
- Instâncias: chip celular
- Aquecedor: fogo
- Disparos: foguete

# Comandos e ações executadas

1. Ajuste do `index.html` com substituição dos ícones nos itens de navegação desktop.
2. Build do projeto:
   - `npm run build`
3. Validação de lint:
   - `ReadLints` em `index.html` sem erros.

# Solução implementada (passo a passo)

1. Ícones atualizados no menu lateral:
   - Dashboard: `📈`
   - Instâncias: `📱`
   - Aquecedor: `🔥`
   - Disparos: `🚀`
2. Build executado para refletir mudança em `dist/index.html`.

# Arquivos criados/alterados

- `index.html` (alterado)
- `dist/index.html` (atualizado via build)
- `doc/LOG-2026-03-27__123528__update-icons-menu-lateral-ambientes.md` (novo)

# Como validar

1. Abrir a aplicação em desktop.
2. Verificar os ícones de cada item no menu lateral:
   - Dashboard (`📈`)
   - Instâncias (`📱`)
   - Aquecedor (`🔥`)
   - Disparos (`🚀`)
3. Confirmar que o menu recolhido e expandido continua funcional.

# Observações de segurança

- Alteração apenas visual no frontend.
- Sem mudança em autenticação, integrações ou processamento de envio.

# Itens para evitar duplicação no futuro (palavras-chave)

- icons-menu-lateral
- dashboard-grafico
- instancias-chip-celular
- aquecedor-fogo
- disparos-foguete
