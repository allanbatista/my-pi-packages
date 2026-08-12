# Regras duráveis do workflow

- `/skill:batista-loop` é o entry point do usuário para objetivos ponta a ponta; `/skill:*` nunca é mecanismo de chamada entre skills.
- Managers (`batista-loop`, `batista-manifest`, `batista-execute`) rodam na sessão raiz; folhas e validators rodam como children com contexto mínimo (fresh) via ferramenta `Agent` (ver `references/PI_ADAPTATION.md`). Sem a extensão `@tintinweb/pi-subagents`, bloqueie com instrução de instalação; não simule worker/guardian/validator inline.
- Guardians e validators são read-only (`read`, `grep`, `find`, `ls`) e nunca editam artefatos nem produto.
- Zero resíduos Codex: sem o pacote de skills legado do Codex e sem definições de agent no formato Codex; agents do package usam `agents/*.md`.
- Política de modelos: **sem pin no frontmatter** — o modelo indicado pelo usuário (sessão raiz ou pedido explícito repassado na chamada `Agent(...)`) prevalece; sem indicação, worker = `openai-codex/gpt-5.6-luna` + effort `low` (write code), validador = `openai-codex/gpt-5.6-luna` + effort `high` (validation). `scripts/validate.sh` (check `agents-drift`) falha se um pin for reintroduzido no package ou no instalado.
- Estado do workflow vive nos artefatos em `.features/{...}/`; o arquivo vence o contexto e resumos não fazem upgrade de status.
- `user-instructions.md` (instruções literais do usuário) é artefato da feature e vive em `.features/{...}/user-instructions.md`, nunca na raiz do projeto.
- Guardians aplicam uma pergunta explícita de minimalismo e alinhamento: o item foi pedido, é fundamental e está alinhado ao resultado do cliente, e o que pode ser removido ou simplificado sem impacto. A spec avalia requisitos; a arch avalia decisões técnicas contra a spec. Excesso vira `Out of Scope`/pergunta ou é simplificado.
