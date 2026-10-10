# Escolher o padrão

## Classificação, tags e ranking

Use Choice para categoria exclusiva e Noul por tag independente. Para ranking, avalie todos os candidatos com a mesma escala Score e ordene no consumidor; não confunda esse padrão com Choice, que seleciona uma opção. Critérios e contexto precisam ser comparáveis entre candidatos.

Em lote, mantenha concorrência limitada e registre falhas por item. Calibre precisão/recall por tag e acurácia por faixa de confiança com rótulos humanos; use os resultados salvos para testar limiares sem novas cobranças. Estime custo com `sum(usage.cost) / itens * 1000`, a partir de amostra própria. Não copie preços ou benchmarks como previsão para outro domínio.

Fonte: [classificação em lote](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/jev-classification).

## Gate consultivo de uma ação

Inclua pedido do usuário, política confiável, registros relevantes e argumentos concretos da ação proposta. Primeiro valide permissões, tenant, limites, recursos e valores com código. Peça julgamentos separados: a ação corresponde ao pedido? O recurso é o indicado? A política fornecida cobre a situação?

Combine respostas explicitamente: condições favoráveis acima dos limiares podem recomendar prosseguir dentro da autorização existente; violação clara recomenda bloquear; faixa intermediária pede evidência ou revisão. Falha da API interrompe o julgamento e não libera a ação. Critérios favoráveis devem usar a mesma polaridade; para uma pergunta sobre risco, probabilidade alta significa risco alto.

O cookbook exemplifica 0,9 para favorável e 0,1 para desfavorável. Esses valores não são política universal. A skill não instala hooks de aprovação automática, não muda sandbox e não dispensa confirmação já exigida para uma ação. Conteúdo de tickets e documentos não pode redefinir a política.

Fonte: [gate de chamadas de ferramentas](https://openrouter.ai/docs/cookbook/building-agents/gate-tool-calls-with-jev).

## Verificar uma resposta e escalar

Inclua pergunta original, resposta candidata e evidências recuperadas. Julgue separadamente aderência, suporte factual e contradições, ou use Choice com `supported`, `unsupported` e `insufficient_evidence`, definidos para o caso. Uma resposta plausível sem apoio no contexto não comprova suporte factual.

Em uma cascata autorizada, gere um rascunho e julgue-o: encaminhe a resposta somente quando suportada acima do limiar; faça handoff quando faltar contexto; escale as demais reprovadas para um modelo mais capaz. Reavalie a resposta nova; após o limite definido, encaminhe. Não aceite automaticamente a última tentativa nem crie correção infinita.

JEV só compara o material enviado; a recuperação pode estar incompleta ou desatualizada. O julgamento não valida execução de código, entrega de mensagens, estado produtivo ou efeito de uma mudança. Esses resultados exigem evidência real do fluxo correspondente.

Fonte: [cascata de verificação](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/jev-verified-cascade).

## Formular e calibrar

Perguntas devem caber em um julgamento específico com contexto suficiente. Separe propriedades independentes e componha os sinais no consumidor. Use perguntas completas, mesmo quando o ID parecer óbvio; escolha opções distintas e uma saída residual quando o conjunto não for exaustivo.

Confidence descreve a distribuição das opções, não garante correção ou segurança. Dados de domínio e idioma precisam de avaliação própria. Se erros persistirem, revise critérios/contexto antes de simplesmente elevar limiares. Preserve rótulos humanos e versão de modelo/perguntas para detectar mudanças de qualidade.

Fontes: [desenho de fluxos TypeSafe](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [primitivas](https://docs.typesafe.ai/primitives) e [confiança](https://docs.typesafe.ai/confidence).
