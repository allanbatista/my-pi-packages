const fs = require("fs");
const path = require("path");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const EXPECTED = ["arch", "execute", "loop", "manifest", "plan", "spec", "ux"];
const EXPECTED_AGENTS = ["artifact-guardian.md", "workflow-validator.md"];

function readFrontmatter(skillPath) {
  const content = fs.readFileSync(skillPath, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, `missing frontmatter: ${skillPath}`);
  const name = match[1].match(/^name:\s*(.+)$/m);
  const description = match[1].match(/^description:\s*(.+)$/m);
  assert.ok(name?.[1]?.trim(), `missing name: ${skillPath}`);
  assert.ok(description?.[1]?.trim(), `missing description: ${skillPath}`);
  return { name: name[1].trim(), description: description[1].trim() };
}

test("package.json is a valid pi package", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.name, "my-pi-packages");
  assert.ok(pkg.keywords.includes("pi-package"));
  assert.deepEqual(pkg.pi.skills, ["./skills"]);
  assert.deepEqual(pkg.pi.subagents.agents, ["./agents"]);
});

test("validate.sh has no hardcoded harness scratch path", () => {
  const script = fs.readFileSync(path.join(ROOT, "scripts/validate.sh"), "utf8");
  assert.doesNotMatch(script, /grok-goal/);
  assert.match(script, /SCRATCH:-/);
});

test("MODEL_POLICY defines planning inherit and execution pinning", () => {
  const policy = fs.readFileSync(path.join(ROOT, "references/MODEL_POLICY.md"), "utf8");
  const settings = JSON.parse(
    fs.readFileSync(path.join(ROOT, "examples/pi-subagents-settings.json"), "utf8")
  );
  assert.match(policy, /model: "inherit"|modelo ativo da sessão/i);
  assert.match(policy, /deepseek\/deepseek-v4-flash/);
  assert.match(policy, /xhigh/);
  assert.equal(settings.subagents.agentOverrides.worker.model, "deepseek/deepseek-v4-flash");
  assert.equal(settings.subagents.agentOverrides.worker.thinking, false);
  assert.equal(
    settings.subagents.agentOverrides["workflow-validator"].model,
    "deepseek/deepseek-v4-flash"
  );
  assert.equal(settings.subagents.agentOverrides["workflow-validator"].thinking, "xhigh");
});

test("PI_ADAPTATION uses the real subagent tool and reserves slash for users", () => {
  const adaptation = fs.readFileSync(path.join(ROOT, "references/PI_ADAPTATION.md"), "utf8");
  assert.match(adaptation, /subagent\(\.\.\.\)/);
  assert.match(adaptation, /entry point.*input do usuário/i);
  assert.match(adaptation, /não simule guardian/i);
  assert.doesNotMatch(adaptation, /spawn_agent|inline é o padrão/i);
});

test("pi-invocation test does not hardcode harness scratch path", () => {
  const testFile = fs.readFileSync(path.join(ROOT, "test/pi-invocation.test.js"), "utf8");
  assert.doesNotMatch(testFile, /grok-goal/);
  assert.match(testFile, /process\.env\.SCRATCH/);
});

test("all seven skills exist with valid frontmatter", () => {
  const skillsDir = path.join(ROOT, "skills");
  const dirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  assert.deepEqual(dirs, [...EXPECTED].sort());
  for (const skill of EXPECTED) {
    const skillPath = path.join(skillsDir, skill, "SKILL.md");
    assert.ok(fs.existsSync(skillPath));
    const fm = readFrontmatter(skillPath);
    assert.equal(fm.name, skill);
    assert.ok(fm.description.length > 0);
  }
});

test("all skill references resolve from the SKILL.md directory", () => {
  for (const skill of EXPECTED) {
    const skillPath = path.join(ROOT, "skills", skill, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    const reference = "../../references/WORKFLOW_COMMON.md";
    assert.ok(content.includes(reference));
    assert.ok(fs.existsSync(path.resolve(path.dirname(skillPath), reference)));
  }
});

test("package exposes read-only workflow guardians", () => {
  const agentsDir = path.join(ROOT, "agents");
  assert.deepEqual(fs.readdirSync(agentsDir).sort(), EXPECTED_AGENTS);
  for (const file of EXPECTED_AGENTS) {
    const content = fs.readFileSync(path.join(agentsDir, file), "utf8");
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)[1];
    const tools = frontmatter.match(/^tools:\s*(.+)$/m)[1];
    assert.equal(tools, "read, grep, find, ls");
    assert.match(frontmatter, /^acceptanceRole:\s*read-only$/m);
  }
});

test("guardian contract is canonical and has no self-approval deadlock", () => {
  const agent = fs.readFileSync(path.join(ROOT, "agents", "artifact-guardian.md"), "utf8");
  const common = fs.readFileSync(path.join(ROOT, "references", "WORKFLOW_COMMON.md"), "utf8");
  assert.match(agent, /exceto o gate autorreferente/);
  assert.match(common, /Não invente um segundo formato de retorno/);
  for (const skill of ["spec", "ux", "arch", "plan", "loop"]) {
    const content = fs.readFileSync(path.join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    assert.doesNotMatch(content, /Saída obrigatória do guardian/);
    assert.match(content, /DELEGATION_RESULT/);
  }
});

test("loop fails closed across sub-features and spec blocks material assumptions", () => {
  const loop = fs.readFileSync(path.join(ROOT, "skills", "loop", "SKILL.md"), "utf8");
  const execute = fs.readFileSync(path.join(ROOT, "skills", "execute", "SKILL.md"), "utf8");
  const spec = fs.readFileSync(path.join(ROOT, "skills", "spec", "SKILL.md"), "utf8");
  const common = fs.readFileSync(path.join(ROOT, "references", "WORKFLOW_COMMON.md"), "utf8");
  assert.match(loop, /\.\.\/manifest\/SKILL\.md/);
  assert.match(loop, /\.\.\/execute\/SKILL\.md/);
  assert.match(loop, /Não encerre pedindo ao usuário para executar a fase/);
  assert.match(loop, /\| Feature \| Dir \| Batch \| Depends on \| Write set \|/);
  assert.match(loop, /rebaixe o Outcome Guardian para `pending`/);
  assert.match(loop, /Nunca declare `converged` com `Integration > E2E: pending`/);
  assert.match(loop, /Root Completion Gate — fail-closed/);
  assert.match(
    loop,
    /Todas as linhas de `Sub-features` têm `manifest=done`, `execute=done`, `Verify=pass` e `Status=done`/
  );
  assert.match(loop, /Aprovação local não atualiza `Integration`/);
  assert.match(loop, /espelhando os primeiros `Status:` de cada `manifest\.md` e `plan\.md`/);
  assert.match(loop, /`manifest\.md > State > Plan` persistirem `done`/);
  assert.match(loop, /não reabrir a concluída/);
  assert.match(loop, /Pre-Guardian Checkpoint/);
  assert.match(loop, /Qualquer `write`, `edit`, `bash` ou child.*invalida o checkpoint/);
  assert.match(loop, /chamada imediatamente seguinte ao último `read`/);
  assert.match(loop, /evidências referenciadas por `Integration > E2E`/);
  assert.match(loop, /Antes do \*\*primeiro dispatch de cada papel\*\*/);
  assert.match(loop, /inclusive por metadata\/status prematuro/);
  assert.match(execute, /feche o estado atomicamente/);
  assert.match(execute, /`manifest\.md > State > Plan: done`/);
  assert.match(execute, /um único workflow-validator por task\/tentativa/);
  assert.match(execute, /Write Boundary — fail-closed/);
  assert.match(execute, /o manager nunca move, copia, recria ou conserta o produto/);
  assert.match(execute, /`\(no output\)` ou envelope ausente \*\*não é falha nem autoriza retry\*\*/);
  assert.match(loop, /não faça outra chamada `subagent` até o `artifact-guardian`/);
  assert.match(loop, /Root Correction Reopen/);
  assert.match(loop, /Manager Tool Firewall/);
  assert.match(loop, /Runbook obrigatório para modelo simples/);
  assert.match(loop, /são relativos ao diretório deste `loop\/SKILL\.md`/);
  assert.match(loop, /worker → workflow-validator → artifact-guardian/);
  assert.match(loop, /Falha de chamada, `context` omitido, `\(no output\)`/);
  assert.match(loop, /qualquer outro path é produto e a chamada é proibida/);
  assert.match(loop, /`manifest=ready`, `execute=fail`, `Verify=pending`, `Status=running`/);
  assert.match(loop, /`State > Plan: ready` — nunca `pending`/);
  assert.match(loop, /preserve o guardian\/readiness do plano `approved`/);
  assert.match(loop, /próximo child após esse worker é obrigatoriamente um único `workflow-validator`/);
  assert.match(loop, /preflight `list`\/`get` exigido para `worker` e `workflow-validator`/);
  assert.match(loop, /execute `pending\|running\|fail` elegível a retry/);
  assert.match(loop, /antes de qualquer incremento ou mutação de reabertura, avalie `Ceiling` e `Anti-thrash`/);
  assert.match(loop, /Se um guard disparar, grave a stop condition e não incremente nem reabra trabalho/);
  assert.match(loop, /É proibido saltar de outcome\/E2E rejeitado para E2E `pass`/);
  assert.match(loop, /Se a correção mudar requisito, contrato, solução ou tasks do plano/);
  assert.match(common, /no máximo um dispatch por par papel\+task/);
  assert.match(common, /índice manager nunca pode ficar `done`/);
  assert.match(loop, /Não incremente no passe inicial.*task ou fase de um plan/);
  assert.match(loop, /não crie uma entrada `0`, resumo de sucesso ou `gap: none`/);
  assert.match(loop, /Somente o `DELEGATION_RESULT` desta chamada.*Outcome Guardian raiz/);
  assert.match(loop, /artifact-guardian` raiz com `model: "inherit"`.*`cwd: "\{canonical-project-root\}"`/);
  assert.match(loop, /Use estes campos literalmente; nenhum pode ser omitido/);
  assert.match(
    loop,
    /Artifact: \{epic-dir\}\/loop\.md[\s\S]*Iteration: \{Iterations used\}[\s\S]*Evidence:/
  );
  assert.match(spec, /Fail-Closed Clarification Gate/);
  assert.match(spec, /origem `suposição explícita`/);
  assert.match(common, /State Reconciliation — fail closed/);
  assert.match(common, /ausência de rejeição não é aprovação/i);
  assert.match(execute, /exija aprovação positiva explícita/);
  assert.match(common, /invalida seu guardian e todos os artefatos\/guardians downstream/);
  assert.match(common, /Não use o parâmetro `skill:/);
  assert.match(common, /feature dir como `cwd`.*valor efetivo divergente é dispatch inválido/);
  assert.match(loop, /feature dir como `cwd`.*valor efetivo divergente invalida o dispatch/);
  assert.doesNotMatch(common, /^\s*skill:\s*"\{skill\}"/m);
});

test("skills use Pi invocation syntax not Codex", () => {
  for (const skill of EXPECTED) {
    const content = fs.readFileSync(path.join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    assert.doesNotMatch(content, /\$my-feature-workflow/);
    if (skill === "loop") {
      assert.match(content, /\/skill:loop/);
      assert.match(content, /manifest\/SKILL\.md/);
      assert.match(content, /execute\/SKILL\.md/);
    }
  }
});

test("no Codex-only artifacts shipped", () => {
  const walk = (dir, acc = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walk(full, acc);
      } else {
        acc.push(full);
      }
    }
    return acc;
  };
  const files = walk(ROOT).filter(
    (f) => !f.includes(`${path.sep}test${path.sep}`) && !f.endsWith("validate.sh")
  );
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    assert.doesNotMatch(rel, /\.codex-plugin/);
    assert.doesNotMatch(rel, /agents\/openai\.yaml/);
    if (rel.endsWith(".md") || rel.endsWith(".json") || rel.endsWith(".js")) {
      const content = fs.readFileSync(file, "utf8");
      if (rel !== "AGENTS.md") {
        assert.doesNotMatch(content, /\$my-feature-workflow/);
      }
    }
  }
});

test("AGENTS.md and RULES describe Pi package", () => {
  const agents = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
  const rules = fs.readFileSync(path.join(ROOT, ".memory", "RULES_AND_DEFINITION.md"), "utf8");
  assert.match(agents, /pi package/i);
  assert.match(agents, /\/skill:loop/);
  assert.match(rules, /\/skill:loop/);
  assert.doesNotMatch(rules, /\.codex-plugin/);
});
