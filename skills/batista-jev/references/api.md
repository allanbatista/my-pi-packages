# Contrato e operação

Envie `POST https://openrouter.ai/api/alpha/decisions`, com `Authorization: Bearer <OPENROUTER_API_KEY>` e `Content-Type: application/json`. Esse endpoint fica fora de `/api/v1/chat/completions`. O helper usa somente a biblioteca padrão do Python.

## Requisição

| Campo | Forma |
| :--- | :--- |
| `model` | O helper usa `typesafe/jev-1.13` se omitido; `--model` sobrescreve o JSON |
| `state` | Texto, objeto ou array JSON com contexto relacionado |
| `questions` | Objeto de IDs para perguntas com `type` e `instructions` |
| `criteria` em Choice | Mapa de opções para suas descrições |
| `criteria` em Noul | Opcional; mapa com `true` e `false` |
| `criteria` em Score | Lista ordenada de descrições de níveis |
| `provider` | Preferências de roteamento; o helper preserva o objeto fornecido |
| `user` | Identificador opcional em string, de 1 a 256 caracteres; não use dados pessoais |
| `session_id` | Opcional, até 256 caracteres, para agrupar chamadas |
| `trace` | Metadados opcionais de observabilidade; não incluir dados sensíveis |

`instructions` e descrições podem ser strings, objetos ou arrays JSON. O cliente exige entradas não vazias e 2–255 opções em Choice e 2–10 níveis em Score, conforme os limites da API, para evitar perguntas sem decisão útil. Use [triage.json](triage.json) como exemplo executável das três primitivas.

O alias `~typesafe/jev-latest` acompanha novas versões e é aceito por `--model`; preferir uma versão identificada em avaliações comparáveis. A resposta pode resolver `typesafe/jev-1.13` para um snapshot datado: registre o modelo retornado, sem exigir igualdade literal com o ID solicitado.

## Resposta e falhas

O helper exige ID, modelo efetivo, uma resposta por pergunta e `usage` com tokens/custo. Valida tipos, opções, índices, legenda, soma de probabilidades e coerência de choice/score/confidence com a distribuição. A tolerância de soma é fixa (0,02); o cliente admite arredondamento documentado, sem crescer a margem indefinidamente com opções. Como política conservadora do cliente, exige `confidence` e `probabilities` em Choice/Score, mesmo quando esses campos forem opcionais no schema remoto. Não supre confiança ausente com aprovação. Preserva o JSON completo para inspeção.

Erros saem em stderr com código diferente de zero e sem o corpo remoto, que pode conter dados da entrada. `400` pede revisão do contrato; `401`/`403`, credencial ou acesso; `402`, créditos ou limite de gasto em voo; `413`, redução do contexto; `429`, espera e orçamento de tentativas; `5xx`, diagnóstico da disponibilidade. Timeout não comprova que a chamada deixou de ser processada ou cobrada. Repetir somente com limite explícito, sem reenviar segredos nem ignorar `Retry-After`, preservado quando legível no erro HTTP; nenhuma repetição é automática. Falha de transporte, inclusive resposta truncada, produz erro sanitizado.

Mantenha a chave no ambiente de execução, nunca no JSON, argumentos, frontend ou artefatos. O helper rejeita redirecionamentos HTTP. `provider` pode expressar requisitos de privacidade, mas não invente suporte a ZDR nem altere configurações da conta; verifique a política atual antes de enviar material sensível.

## Validação aplicável

Execute `python3 "$JEV_SKILL_DIR/scripts/test_jev.py"` para entradas inválidas, respostas incompletas, probabilidades fora do domínio e falhas HTTP/rede. Para E2E, execute a CLI com `references/triage.json` contra a conta OpenRouter e salve a resposta. Confira `topic.choice == "billing"`, `refund_requested.noul > 0.5`, o Score no intervalo 0–2 e ID/modelo/custo. O limiar 0,5 serve apenas para conferir este exemplo explícito; não calibra um fluxo produtivo. Não existem workers, banco, Browser ou efeitos externos nesse cliente; o artefato final é a resposta JSON. Esse teste não mede eficácia da skill em sessões reais nem precisão em dados de domínio.

Fontes: [referência da API](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request), [tutorial](https://openrouter.ai/docs/guides/community/jev-tutorial), [estado](https://docs.typesafe.ai/concepts/state) e [estrutura de perguntas](https://docs.typesafe.ai/primitives) e [fórmulas de confiança](https://docs.typesafe.ai/confidence).
