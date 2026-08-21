const fs = require("fs");
const path = require("path");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const WORKFLOW = [
  "batista-arch",
  "batista-execute",
  "batista-incident",
  "batista-loop",
  "batista-manifest",
  "batista-plan",
  "batista-spec",
  "batista-ux",
  "batista-validation",
];
const EXPECTED = [
  ...WORKFLOW,
  "batista-discord-webhook-messages",
  "batista-manager-orchestrator",
  "batista-memory",
  "batista-ship-pr-to-deploy",
  "batista-websearch",
  "batista-worktree",
];
const EXPECTED_AGENTS = ["artifact-guardian.md", "batista-engineer.md", "code-reviewer.md", "delegate.md", "reviewer.md", "worker.md", "workflow-validator.md"];
const READONLY_ROLE_AGENTS = ["artifact-guardian.md", "code-reviewer.md", "reviewer.md", "workflow-validator.md"];

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

test("MODEL_POLICY: no pinned model/thinking; user indication prevails; defaults low/high", () => {
  const policy = fs.readFileSync(path.join(ROOT, "references/MODEL_POLICY.md"), "utf8");
  const settings = JSON.parse(fs.readFileSync(path.join(ROOT, "examples/subagents.json"), "utf8"));
  assert.match(policy, /herda a sessão raiz/i);
  assert.match(policy, /openai-codex\/gpt-5.6-luna/);
  assert.match(policy, /write code = low effort/i);
  assert.match(policy, /validation = high effort/i);
  assert.equal(settings.maxConcurrent, 4);
  for (const agent of ["worker.md", "workflow-validator.md"]) {
    const file = fs.readFileSync(path.join(ROOT, "agents", agent), "utf8");
    assert.doesNotMatch(file, /^model:/m, `${agent} must not pin model`);
    assert.doesNotMatch(file, /^thinking:/m, `${agent} must not pin thinking`);
  }
});

test("PI_ADAPTATION documents the real Agent tool and reserves slash for users", () => {
  const adaptation = fs.readFileSync(path.join(ROOT, "references/PI_ADAPTATION.md"), "utf8");
  assert.match(adaptation, /Agent\(\{["']\s*subagent_type|subagent_type: "worker"/);
  assert.match(adaptation, /entry point.*input do usuário/i);
  assert.match(adaptation, /não simule guardian/i);
  assert.doesNotMatch(adaptation, /spawn_agent|inline é o padrão/i);
  assert.doesNotMatch(adaptation, /action: "list"|action: "get"/);
});

test("pi-invocation test does not hardcode harness scratch path", () => {
  const testFile = fs.readFileSync(path.join(ROOT, "test/pi-invocation.test.js"), "utf8");
  assert.doesNotMatch(testFile, /grok-goal/);
  assert.match(testFile, /process\.env\.SCRATCH/);
});

test("all skills exist with valid frontmatter", () => {
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

test("all workflow skill references resolve from the SKILL.md directory", () => {
  for (const skill of WORKFLOW) {
    const skillPath = path.join(ROOT, "skills", skill, "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf8");
    const reference = "../../references/WORKFLOW_COMMON.md";
    assert.ok(content.includes(reference));
    assert.ok(fs.existsSync(path.resolve(path.dirname(skillPath), reference)));
  }
});

test("package exposes workflow role agents (guardians read-only)", () => {
  const agentsDir = path.join(ROOT, "agents");
  assert.deepEqual(fs.readdirSync(agentsDir).sort(), EXPECTED_AGENTS);
  for (const file of EXPECTED_AGENTS) {
    const content = fs.readFileSync(path.join(agentsDir, file), "utf8");
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)[1];
    const tools = frontmatter.match(/^tools:\s*(.+)$/m)[1];
    assert.ok(tools.length > 0, `missing tools: ${file}`);
    assert.match(frontmatter, /^prompt_mode:\s*replace$/m);
  }
  for (const file of READONLY_ROLE_AGENTS) {
    const content = fs.readFileSync(path.join(agentsDir, file), "utf8");
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)[1];
    assert.equal(frontmatter.match(/^tools:\s*(.+)$/m)[1], "read, grep, find, ls");
    assert.match(frontmatter, /^extensions:\s*false$/m);
    assert.match(frontmatter, /^acceptanceRole:\s*read-only$/m);
  }
  for (const file of ["worker.md", "delegate.md"]) {
    const content = fs.readFileSync(path.join(agentsDir, file), "utf8");
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)[1];
    assert.match(frontmatter, /write/);
    assert.doesNotMatch(frontmatter, /acceptanceRole/);
  }
});

test("guardian contract is canonical and has no self-approval deadlock", () => {
  const agent = fs.readFileSync(path.join(ROOT, "agents", "artifact-guardian.md"), "utf8");
  const common = fs.readFileSync(path.join(ROOT, "references", "WORKFLOW_COMMON.md"), "utf8");
  assert.match(agent, /exceto o gate autorreferente/);
  assert.match(common, /Não invente um segundo formato de retorno/);
  for (const skill of ["batista-spec", "batista-ux", "batista-arch", "batista-plan", "batista-loop"]) {
    const content = fs.readFileSync(path.join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    assert.doesNotMatch(content, /Saída obrigatória do guardian/);
    assert.match(content, /DELEGATION_RESULT/);
  }
});

test("spec and arch guardians enforce client-aligned minimalism", () => {
  const agent = fs.readFileSync(path.join(ROOT, "agents", "artifact-guardian.md"), "utf8");
  const spec = fs.readFileSync(path.join(ROOT, "skills", "batista-spec", "SKILL.md"), "utf8");
  const arch = fs.readFileSync(path.join(ROOT, "skills", "batista-arch", "SKILL.md"), "utf8");
  assert.match(agent, /Pergunta de Minimalismo e Alinhamento/);
  assert.match(agent, /removido ou simplificado/);
  assert.match(spec, /fundamental and aligned with.*client's requested functionality\/result/);
  assert.match(spec, /What can be removed or simplified without impacting the request/);
  assert.match(arch, /necessary for an approved spec requirement/);
  assert.match(arch, /What can be removed or simplified without impact/);
});

test("loop fails closed across sub-features and spec blocks material assumptions", () => {
  const loop = fs.readFileSync(path.join(ROOT, "skills", "batista-loop", "SKILL.md"), "utf8");
  const execute = fs.readFileSync(path.join(ROOT, "skills", "batista-execute", "SKILL.md"), "utf8");
  const spec = fs.readFileSync(path.join(ROOT, "skills", "batista-spec", "SKILL.md"), "utf8");
  const common = fs.readFileSync(path.join(ROOT, "references", "WORKFLOW_COMMON.md"), "utf8");
  assert.match(loop, /\.\.\/batista-manifest\/SKILL\.md/);
  assert.match(loop, /\.\.\/batista-execute\/SKILL\.md/);
  assert.match(loop, /Never end asking the user to run the phase\./);
  assert.match(loop, /\| Feature \| Dir \| Batch \| Depends on \| Write set \|/);
  assert.match(loop, /downgrade Outcome Guardian `pending`|Outcome Guardian → downgrade `pending`/);
  assert.match(loop, /Never declare `converged` with `Integration > E2E: pending`/);
  assert.match(loop, /Root Completion Gate — fail-closed/);
  assert.match(loop, /Every `Sub-features` line: `manifest=done`, `execute=done`, `Verify=pass`, `Status=done`/);
  assert.match(loop, /Local approval never updates epic `Integration`/);
  assert.match(loop, /mirroring the first `Status:` of each `manifest\.md`\/`plan\.md`/);
  assert.match(loop, /`manifest\.md > State > Plan` persist `done`/);
  assert.match(loop, /don't reopen the done one/);
  assert.match(loop, /Pre-Guardian Checkpoint/);
  assert.match(loop, /Any `write`, `edit`, `bash` or child after those reads invalidates the checkpoint/);
  assert.match(loop, /call immediately after the last `read` of a clean checkpoint/);
  assert.match(loop, /evidence referenced by `Integration > E2E`/);
  assert.match(loop, /Before the \*\*first dispatch of each role\*\*/);
  assert.match(loop, /incl\. premature metadata\/status/);
  assert.match(execute, /close state atomically/);
  assert.match(execute, /`manifest\.md > State > Plan: done`/);
  assert.match(execute, /exactly one workflow-validator per task\/attempt/);
  assert.match(execute, /Write Boundary — fail-closed/);
  assert.match(execute, /the manager never moves, copies, recreates, or fixes product files/);
  assert.match(execute, /`\(no output\)` or missing envelope is \*\*neither failure nor retry authorization\*\*/);
  assert.match(loop, /no `Agent` call until `artifact-guardian`/);
  assert.match(loop, /Root Correction Reopen/);
  assert.match(loop, /Manager Tool Firewall/);
  assert.match(loop, /Mandatory runbook \(simple models\)/);
  assert.match(loop, /are relative to this `batista-loop\/SKILL\.md` dir/);
  assert.match(loop, /worker → workflow-validator → artifact-guardian/);
  assert.match(loop, /Failed call, omitted `context`, `\(no output\)`/);
  assert.match(loop, /Any other path is product; call forbidden/);
  assert.match(loop, /`manifest=ready`, `execute=fail`, `Verify=pending`, `Status=running`/);
  assert.match(loop, /`State > Plan: ready` — never `pending`/);
  assert.match(loop, /keep plan guardian\/readiness `approved`/);
  assert.match(loop, /child after that worker must be a single `workflow-validator`/);
  assert.match(loop, /Preflight real para `worker` e `workflow-validator`/);
  assert.match(loop, /`pending\|running\|fail` retry-eligible/);
  assert.match(loop, /before any increment or reopen mutation, evaluate `Ceiling`\/`Anti-thrash`/);
  assert.match(loop, /Guard fires → record stop condition; no increment\/reopen\./);
  assert.match(loop, /Rejected outcome\/E2E → E2E `pass`, root guardian or `converged` jump is forbidden\./);
  assert.match(loop, /Fix changes requirement\/contract\/solution\/plan tasks → don't preserve approvals/);
  assert.match(common, /no máximo um dispatch por par papel\+task/);
  assert.match(common, /índice manager nunca pode ficar `done`/);
  assert.match(loop, /Never increment on initial pass or for .*task or plan phase\./);
  assert.match(loop, /no `0` entry, success summary or `gap: none`/);
  assert.match(loop, /Only this call's `DELEGATION_RESULT`[\s\S]*update the root Outcome Guardian\./);
  assert.match(loop, /`artifact-guardian` via `Agent\(\{ subagent_type: "artifact-guardian"[\s\S]*modelo herdado da sessão/);
  assert.match(loop, /Fields literal; none omitted/);
  assert.match(
    loop,
    /Artifact: \{epic-dir\}\/loop\.md[\s\S]*Iteration: \{Iterations used\}[\s\S]*Evidence:/
  );
  assert.match(spec, /Fail-Closed Clarification Gate/);
  assert.match(spec, /origin: \{user \| recorded decision \| explicit assumption/);
  assert.match(common, /State Reconciliation — fail closed/);
  assert.match(common, /ausência de rejeição não é aprovação/i);
  assert.match(execute, /require explicit positive approval/);
  assert.match(common, /invalida seu guardian e todos os artefatos\/guardians downstream/);
  assert.match(common, /Não use o parâmetro `skill:/);
  assert.match(common, /feature dir como `cwd`.*valor efetivo divergente é dispatch inválido/);
  assert.match(loop, /feature dir como `cwd`[\s\S]*invalidates dispatch, promotes no state/);
  assert.doesNotMatch(common, /^\s*skill:\s*"\{skill\}"/m);
});

test("skills use Pi invocation syntax not Codex", () => {
  for (const skill of EXPECTED) {
    const content = fs.readFileSync(path.join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    assert.doesNotMatch(content, /\$my-feature-workflow/);
    if (skill === "batista-loop") {
      assert.match(content, /\/skill:batista-loop/);
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

test("README documents dependencies and extensions with the scoped extension", () => {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.match(readme, /@tintinweb\/pi-subagents/);
  assert.match(readme, /pi install npm:@tintinweb\/pi-subagents/);
  assert.match(readme, /## Dependências/);
  assert.match(readme, /## Extensões/);
  const adaptation = fs.readFileSync(path.join(ROOT, "references", "PI_ADAPTATION.md"), "utf8");
  assert.match(adaptation, /npm:@tintinweb\/pi-subagents/);
  assert.doesNotMatch(adaptation, /npm:pi-subagents/);
});

test("AGENTS.md and RULES describe Pi package", () => {
  const agents = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
  const rules = fs.readFileSync(path.join(ROOT, ".memory", "RULES_AND_DEFINITION.md"), "utf8");
  assert.match(agents, /pi package/i);
  assert.match(agents, /\/skill:batista-loop/);
  assert.match(rules, /\/skill:batista-loop/);
  assert.doesNotMatch(rules, /\.codex-plugin/);
});
