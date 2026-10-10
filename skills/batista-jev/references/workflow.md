# Checks consultivos do workflow

O [catálogo versionado](workflow-checks.json) v1.0.0 define perguntas, evidência mínima, critérios e tratamento da incerteza. Leia somente os checks pertinentes à dúvida concreta. `alignment` compara item/pedido; `traceability` compara requisito/tarefa/validação; `claim_support` distingue sustentada, contradita e evidência insuficiente; `investigation_stage` sugere etapa; `repeated_failure` compara manifestações do histórico; `complementary_risk` usa escala explícita 0–3 somente para priorizar testes complementares. Todos os testes obrigatórios e E2E permanecem.

## Entrada e execução

`workflow.py --case arquivo.json --prepare-only` prepara a requisição offline. Cada caso avalia um único candidato, requisito ou alegação; para vários itens, prepare casos separados e compartilhe o orçamento da tarefa. Não agregue itens distintos numa pergunta vaga. O caso contém `checks` (IDs distintos), `state` (campos mínimos do catálogo) e `evidence_refs` (referências inspecionáveis). `model` opcional preserva a indicação explícita do usuário; sem indicação usa o default do cliente JEV. Inclua nos textos de `links` os IDs existentes (`R#`/`D#` → `Task #` → `V#`), descrições e resultados esperados. IDs sem conteúdo não comprovam cobertura.

```bash
python3 "$JEV_SKILL_DIR/scripts/workflow.py" --case case.json --prepare-only
python3 "$JEV_SKILL_DIR/scripts/workflow.py" --case case.json --sanitized \
  --ledger '<artefato autorizado>/jev.sqlite' --max-calls 2 --known-cost-limit 0.01
```

Agrupe perguntas independentes sobre o mesmo estado; dependências exigem outro caso e nova reserva. O helper faz uma chamada por execução, sem retries. Defina orçamento no início da tarefa e reutilize o mesmo ledger e limites em todos os processos; não troque arquivo/limites para escapar do orçamento. SQLite reserva atomicamente antes da rede; timeout, erro e interrupção consomem tentativa. Caso idêntico não é repetido. Custos conhecidos impedem novas chamadas após o limite; custo em voo/desconhecido não permite prometer teto financeiro rígido. Não use concorrência para gastar saldo financeiro ainda não observado.

O wrapper não é requisito da autoria. Write sets fechados (por exemplo, somente `spec.md` ou `manifest.md`/`plan.md`/`validation.md`) não autorizam SQLite implicitamente; não acrescente paths nem children. Sem caminho de ledger explicitamente autorizado, a consulta pelo wrapper fica indisponível: siga os checks existentes ou prepare offline e registre no artefato permitido. `--sanitized` declara sanitização, não concede autorização de pagamento ou escrita.

A execução exige autorização paga e revisão de sanitização (`--sanitized` é declaração, não detector de segredos). Envie somente contexto autorizado mínimo; referências também não podem conter segredos, tokens ou URLs privadas assinadas. O ledger guarda perguntas, referências, hash do pedido, resposta, modelo efetivo, probabilidades/custo e encaminhamento genérico; não guarda `state` bruto. Atualize o encaminhamento concreto no artefato autorizado da skill. Erro conserva a reserva com resultado `unavailable`; não grava corpo remoto nem exceção. Sem write set compatível, use preparo offline e o retorno autorizado, sem criar ledger fora do escopo.

`insufficient_evidence`, `unclear`, distribuições ambíguas ou falta da API pedem evidência/revisão; não alteram status. Noul/Score preservam distribuição, legenda e confiança, sem limiar universal. Etapa sugerida e recorrência não confirmam causa: confira logs/código/reprodução. JEV não promove `ready`, `pass`, `done`, merge ou deploy; reviewers/validators permanecem independentes e read-only. Worktree continua determinístico.

## Piloto mensurável

[workflow-cases.json](workflow-cases.json) oferece casos sintéticos rotulados; são fixtures de contrato, não prova de ganho real. Para piloto, fixe versão do catálogo/modelo e amostra representativa rotulada por pessoas (incluindo pt-BR); compare com/sem JEV: erros não detectados, falsos alertas, retrabalho, tempo e custo por caso. Separe calibração de avaliação, contabilize inconclusivos e compare matrizes de confusão por check. Só estabeleça limiares por pergunta após medir custo do erro. Mudanças de pergunta/modelo exigem nova medição; não envie dados privados sem autorização.
