---
name: batista-discord-webhook-messages
description: "Publicar e gerenciar mensagens e anexos do Discord via bot, sempre em threads agrupadas por sessão e com identidade hierárquica do agente; enviar atualizações em Markdown, consultar, editar ou excluir mensagens, fazer perguntas livres com espera por resposta e perguntas estruturadas por poll. Use como `/skill:batista-discord-webhook-messages` para notificações de Codex, Pi ou Claude nos canais working, pull-requests, releases e geral, incluindo release notes amigáveis para usuários."
---

# Mensagens do Discord por sessão

Usar somente `scripts/discord_message.py` (caminho relativo a esta pasta de skill: `skills/batista-discord-webhook-messages/scripts/discord_message.py`). Exigir `DISCORD_APP_MY_MY_DEV_BOT_TOKEN_BOT`; tratar todas as credenciais como segredo e nunca exibi-las.

| Variável | Uso |
| --- | --- |
| `DISCORD_APP_MY_MY_DEV_BOT_APP_ID` | identificar e validar o aplicativo/bot |
| `DISCORD_APP_MY_MY_DEV_BOT_PUBBLIC_KEY` | verificar assinaturas de interações recebidas |
| `DISCORD_APP_MY_MY_DEV_BOT_TOKEN_BOT` | autenticar as chamadas REST deste script |
| `DISCORD_APP_MY_MY_DEV_BOT_WEBHOOK_TOKEN` | responder interações/webhooks quando esse fluxo existir |

O fluxo atual é exclusivamente de saída pela API REST do bot e consome somente `DISCORD_APP_MY_MY_DEV_BOT_TOKEN_BOT`. Não usar webhook para publicar mensagens nem reutilizar as variáveis antigas da RedQueen.

## Canais

| Nome | ID | Uso |
| --- | --- | --- |
| `releases` | `1529459842937393213` | somente release notes após merge confirmado em `main` ou `master` |
| `working` | `1529460052958908537` | plano, execução, testes e conclusão local antes de abrir PR |
| `pull-requests` | `1529517597064691712` | PR aberto, CI, review, correções e espera pelo merge |
| `geral` | `1529425753756799119` | mensagens sem vínculo com uma task |

Seguir o fluxo `working` → `pull-requests` → `releases`. Manter em `working` enquanto a mudança estiver local ou apenas na branch. Após abrir o PR, publicar em `pull-requests` até o merge, incluindo CI, review, correções, bloqueios e estado pronto para merge. Usar `releases` somente depois de confirmar que o merge entrou em `main` ou `master`. Se a tarefa não tiver PR, concluir em `working`; se o PR não for incorporado, concluir ou bloquear em `pull-requests`; nunca publicar em `releases` antes do merge.

Antes de publicar em `releases`, confirmar que o SHA incorporado possui uma tag de versão publicada no remoto. Respeitar a convenção do repositório; se não existir, iniciar em `v1.0.0` e incrementar PATCH a cada merge. Reutilizar uma tag SemVer que já aponte exatamente ao mesmo SHA. Nunca mover, sobrescrever ou publicar tag com force. O envio para `releases` exige `**Versão:** \`vMAJOR.MINOR.PATCH\`` no conteúdo.

Publicar sempre dentro de uma thread. O script cria uma thread por sessão e canal e reutiliza seu ID nas próximas mensagens. Usar `PI_SESSION_ID` (Pi), `CODEX_THREAD_ID` (Codex) ou os identificadores equivalentes disponíveis; quando ausentes, usar repositório + branch como chave. Em `working` e `pull-requests`, usar uma branch específica como nome da thread, sem incluir repositório ou diretório; em `main`, `master`, detached HEAD ou fora de Git, usar toda a cadeia de `--name`, sem o code agent. Em `releases`, informar sempre `--thread-name` com um título editorial curto e compreensível para usuários. Não usar branch, diretório, número de PR, hash, "merge/deploy" ou nome interno de task no título. Exemplo: usar `Mais controle nas investigações e políticas`, não `feature/permitir-edicao-agent-discovery` nem `Merge e deploy PR 129`. Usar `Sessão geral` somente quando nenhuma sessão estiver disponível. Aceitar `--session-id` para sobrescrever a sessão.

## Identidade hierárquica

Informar `--name` em todo `send`, `ask` e `edit`. Passar somente a cadeia de sessões, separada por ` > `; o script acrescenta o `--agent` no início. A sessão raiz usa `--name "Ajustes Discord"`; um subagent preserva a cadeia recebida e acrescenta o próprio nome, por exemplo `--name "Ajustes Discord > Testes"`. O autor visual será `Codex > Ajustes Discord > Testes`. Em `releases`, usar no `--name` o mesmo título amigável da release, sem descrever a operação de merge ou deploy.

## Enviar

```bash
set -a; source /home/allanbatista/.secrets; set +a
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py send \
  --agent Codex --name "Ajustes Discord" --channel working \
  --content $'### 🔄 Em andamento\nImplementando o agrupamento por sessão.\n\n**Próximo:** validar o envio real.'

rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py send \
  --agent Codex --name "Mais controle nas investigações" --channel releases \
  --thread-name "Mais controle nas investigações" \
  --content $'### 🚀 Mais controle nas investigações\nAgora é possível ajustar a descrição antes de usar uma investigação.\n\n### 🔧 Detalhes técnicos\n- **Versão:** `v1.0.0`\n- **Merge:** PR #123 incorporado em `main`.\n- **Validação:** smoke pós-merge aprovado.' \
  --mention-everyone \
  --file ./report.txt
```

Escrever Markdown no `--content` e separar título, corpo e ações com quebras de linha. O script converte sequências não escapadas `\n` e `\r\n` recebidas pelo CLI em quebras reais; usar `\\n` quando precisar exibir a sequência literalmente. O bot aparece como autor real `my-dev-bot`; o embed mostra a identidade hierárquica e o logo de Codex, Pi ou Claude. Repetir `--file` para anexar múltiplos arquivos.

Usar templates curtos de timeline:

```markdown
### 🔄 Em andamento
<estado atual>

**Próximo:** <ação>
```

```markdown
### ✅ Concluído
<resultado>

**Validação:** <evidência>
```

Usar `Concluído` em `working` enquanto não houver merge. Depois do merge confirmado, publicar em `releases` com linguagem de produto. Começar pelo que mudou e pelo benefício para o usuário; deixar PR, commit, serviços, CI e deploy apenas na última seção técnica. Incluir somente as categorias que tiverem conteúdo:

```markdown
### 🔎 Pull request
<PR aberto ou etapa relevante concluída>

**Estado:** <CI, review ou prontidão>
**Próximo:** <ação>
```

```markdown
### 🚀 <título orientado ao benefício>
<resumo em linguagem simples, compreensível sem contexto técnico>

### ✨ Novidades
- <nova capacidade para o usuário>

### 📈 Melhorias
- <experiência ou comportamento aprimorado>

### 🐛 Correções
- <problema corrigido e efeito percebido>

### 🔧 Detalhes técnicos
- **Versão:** `vMAJOR.MINOR.PATCH`
- **Merge:** <PR ou commit em main/master>
- **Validação:** <smoke pós-merge>
```

```markdown
### ⛔ Bloqueado
<motivo>

**Preciso de:** <decisão ou dado>
```

Não repetir task, branch ou contexto em toda mensagem; a thread já preserva essa timeline.

## Menções

Mencionar usuários somente quando a notificação for necessária. Em `send`, repetir `--mention-user-id` para até 100 IDs ou usar `--mention-everyone` em releases:

O usuário principal é `cafeina_infinita` (`321460958998560768`). Marcar esse ID quando um problema realmente interromper a task. Toda nova release, depois de confirmar o merge em `main` ou `master`, deve usar `--mention-everyone`. Não marcar por falhas transitórias recuperadas sem interrupção. Usar somente o ID de `cafeina_infinita` em `ask --user-id` quando a continuidade depender de resposta.

```bash
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py send \
  --agent Codex --name "Ajustes Discord" --channel working \
  --content $'### ⛔ Decisão necessária\nPreciso confirmar o ambiente.' \
  --mention-user-id 321460958998560768
```

O script escreve `<@USER_ID>` no conteúdo e restringe `allowed_mentions.users` aos IDs informados; `--mention-everyone` escreve `@everyone` e permite apenas essa menção. Sem essas opções, nenhuma menção é interpretada. Em `ask`, `--user-id` menciona uma pessoa e também restringe a resposta esperada a ela.

## Perguntar e aguardar

Fazer pergunta livre e aceitar a primeira resposta humana na thread, ou restringir com `--user-id`:

```bash
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py ask \
  --agent Codex --name "Ajustes Discord" --channel working \
  --question "Qual ambiente devo validar?" --user-id USER_ID
```

Fazer pergunta estruturada com 2–10 opções usando uma poll nativa:

```bash
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py ask \
  --agent Codex --name "Ajustes Discord" --channel working --question "Como devo prosseguir?" \
  --option "Aplicar agora" --option "Manter somente local" --user-id USER_ID
```

Consultar uma vez a cada 15 segundos e encerrar após a resposta ou 24 horas. Aceitar `--timeout` entre 1 e `86400` segundos. O processo pode permanecer aberto; ao receber um session ID da ferramenta de execução, continuar acompanhando-o sem bloquear atualizações ao usuário por mais de 60 segundos. A resposta final sai como JSON.

## Consultar, editar e excluir

Resolver a thread pela sessão e pelo canal; usar `--thread-id` somente para operar uma thread explícita.

```bash
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py get MESSAGE_ID --channel working
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py edit MESSAGE_ID --channel working --agent Codex --name "Ajustes Discord" --content "### ✅ Atualizado\nNovo conteúdo."
rtk proxy python3 skills/batista-discord-webhook-messages/scripts/discord_message.py delete MESSAGE_ID --channel working --yes
```

Exigir confirmação explícita antes de excluir. Não anexar segredos nem arquivos fora do escopo do usuário. Impedir menções automáticas; mencionar deliberadamente somente com `send --mention-user-id`, `send --mention-everyone` ou `ask --user-id`.

Fontes: https://docs.discord.com/developers/resources/channel, https://docs.discord.com/developers/resources/message, https://docs.discord.com/developers/resources/poll e https://docs.discord.com/developers/reference#uploading-files
