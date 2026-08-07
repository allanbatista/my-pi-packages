const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SCRATCH = process.env.SCRATCH;
const WORKFLOW_SKILLS = [
  "batista-arch",
  "batista-execute",
  "batista-loop",
  "batista-manifest",
  "batista-plan",
  "batista-spec",
  "batista-ux",
];
const EXPECTED_SKILLS = [
  ...WORKFLOW_SKILLS,
  "batista-discord-webhook-messages",
  "batista-memory",
  "batista-ship-pr-to-deploy",
  "batista-websearch",
];

function piAvailable() {
  return spawnSync("pi", ["--version"], { encoding: "utf8" }).status === 0;
}

function runPi(
  prompt,
  cwd = ROOT,
  timeout = 180_000,
  tools = "read,write,edit,grep,find,ls,Agent,get_subagent_result,steer_subagent"
) {
  const args = [
    "-e",
    ROOT,
    "--approve",
    "--no-session",
    "-np",
    "--no-themes",
    "--mode",
    "json",
    "--tools",
    tools,
  ];
  if (process.env.PI_TEST_MODEL) args.push("--model", process.env.PI_TEST_MODEL);
  args.push("-p", prompt);
  const result = spawnSync("pi", args, {
    cwd,
    encoding: "utf8",
    timeout,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) {
    maybeSaveEvidence(
      "pi-run-error.log",
      `error: ${result.error.stack || result.error}\n--- stdout ---\n${result.stdout || ""}\n--- stderr ---\n${result.stderr || ""}`
    );
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`pi exited ${result.status}: ${result.stderr || result.stdout}`);
  }
  const events = (result.stdout || "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const agentEnd = [...events].reverse().find((event) => event.type === "agent_end");
  assert.ok(agentEnd, "missing Pi agent_end trace");
  const messages = agentEnd.messages || [];
  const content = messages.flatMap((message) => message.content || []);
  const toolCalls = content.filter((item) => item.type === "toolCall");
  const toolResults = messages.filter((message) => message.role === "toolResult");
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const text = (lastAssistant?.content || [])
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("")
    .trim();
  return { text, toolCalls, toolResults };
}

function runRpc(command) {
  const result = spawnSync(
    "pi",
    ["-e", ROOT, "-ns", "-ne", "-np", "-nc", "--no-session", "--mode", "rpc"],
    { encoding: "utf8", input: `${JSON.stringify({ type: command })}\n`, timeout: 30_000 }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .find((entry) => entry.type === "response" && entry.command === command);
}

function maybeSaveEvidence(name, content) {
  if (!SCRATCH) return;
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(path.join(SCRATCH, name), `${content}\n`);
}

function traceEvidence(trace) {
  return JSON.stringify(trace, null, 2);
}

function toolResultText(trace, call) {
  const result = trace.toolResults.find((item) => item.toolCallId === call.id);
  return (result?.content || [])
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

function toolResultModels(trace, call) {
  const result = trace.toolResults.find((item) => item.toolCallId === call.id);
  return (result?.details?.results || []).map((item) => item.model).filter(Boolean);
}

function roleAgentFrontmatter(role) {
  return fs.readFileSync(path.join(ROOT, "agents", role + ".md"), "utf8");
}

function subagentLaunches(trace) {
  return trace.toolCalls.filter((call) => {
    if (call.name !== "Agent") return false;
    if (!call.arguments?.subagent_type) return false;
    const result = trace.toolResults.find((item) => item.toolCallId === call.id);
    return result != null;
  });
}

/** Real preflight: the manager reads the role's agent file before any dispatch. */
function agentPreflightIndex(trace, role) {
  return trace.toolCalls.findIndex((call) => {
    if (call.name !== "read") return false;
    const args = JSON.stringify(call.arguments || {});
    return args.includes(`agents/${role}.md`);
  });
}

function effectiveDispatch(trace, call) {
  return call.arguments || {};
}

function explicitlyApproves(text) {
  return (
    !/\b(?:status|guardian):\s*(?:rejected|fail|blocked|pending)\b|\bn(?:ã|a)o\s+(?:foi\s+)?aprovad[oa]\b/i.test(
      text
    ) &&
    /(?:^|\n)(?:status|guardian):\s*approved\b|\b(?:aprovad[oa]|validated|validado|passed|passou|passaria)\b/im.test(
      text
    )
  );
}

function validatorResultApproves(trace, call) {
  if (explicitlyApproves(toolResultText(trace, call))) return true;
  const result = trace.toolResults.find((item) => item.toolCallId === call.id);
  const reports = (result?.details?.results || []).map((item) => item.acceptance?.childReport);
  return (
    reports.length > 0 &&
    reports.every((report) => {
      if (!report || !(report.criteriaSatisfied || []).length) return false;
      if ((report.criteriaSatisfied || []).some((item) => item.status !== "satisfied")) return false;
      if (!(report.residualRisks || []).every((risk) =>
        /^\s*(?:none|nenhum|n\/a)\s*$/i.test(String(risk))
      )) return false;
      const findings = (report.reviewFindings || [])
        .join("\n")
        .replace(/\bno blockers?\b/gi, "")
        .replace(/\bsem blockers?\b/gi, "");
      return !/\b(?:rejected|reprovad[oa]|fail(?:ed)?|violation|does not meet|blocker)\b/i.test(
        findings
      );
    })
  );
}

function createSandbox(t) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "pi-workflow-"));
  fs.writeFileSync(
    path.join(sandbox, "AGENTS.md"),
    "# Sandbox\nDocumentação em pt-BR. Não altere arquivos fora deste diretório.\n"
  );
  t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
  return sandbox;
}

function writeFixture(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${content.trim()}\n`);
}

function writeReadyExecutionFeature(epicDir, { dirName, title, outputFile }) {
  const featureDir = path.join(epicDir, dirName);
  writeFixture(
    path.join(featureDir, "manifest.md"),
    `# ${title} Manifest

Status: ready
Updated: 2099-01-01 00:02
Spec: ./spec.md
UX: none
Arch: none
Plan: ./plan.md

## State
- Spec: ready
- UX: not-applicable
- Arch: not-applicable
- Plan: ready
- Spec Guardian: approved
- UX Guardian: not-applicable
- Arch Guardian: not-applicable
- Plan Guardian: approved

## Current Resume Point
- Next action: execute task 1.1
- Owner/Subagent: unassigned
- Blockers: none
- Open clarifications: none
- Last resume check: fixture

## Evidence Index
- ./spec.md
- ./plan.md`
  );
  writeFixture(
    path.join(featureDir, "spec.md"),
    `# ${title}

Status: ready
Updated: 2099-01-01 00:02

## Objective
Criar ${outputFile} com conteúdo exato ok.

## Discovery Ledger
| ID | Source | Finding | Evidence | Impact | Status |
|---|---|---|---|---|---|
| D1 | usuário | artefato solicitado | objetivo persistido | escopo | confirmed |

## Intent Classification
- User intent: pontual/localizada
- Rationale: um arquivo sem contrato compartilhado
- Coverage expectation: somente fluxo afetado

## Scope
- ${outputFile}

## Out of Scope
- qualquer outro arquivo de produto

## Questions and Decisions
- none

## Requirements Traceability
| Need | Requirement (EARS) | Acceptance criterion (Dado/Quando/Então) | Validation surface | Basis | Status |
|---|---|---|---|---|---|
| fixture | Quando a task executar, o sistema deve criar ${outputFile} com conteúdo ok. | Dado o projeto, Quando a task terminar, Então ${outputFile} contém exatamente ok. | CLI | D1 | defined |

## Contract and Persistence
- Changed contracts: none
- Persistence: ${outputFile} é somente artefato de aceite
- Validation surfaces: CLI
- Ambiguities: none

## Shared Contract
- Status: none
- Payloads/campos: none
- Estados e erros: none
- Sequência mínima: none
- Basis: D1

## Acceptance Criteria
- Dado o projeto, Quando a task terminar, Então ${outputFile} contém exatamente ok.

## Clarifications Needed
none

## Spec Readiness Gates
- [x] AGENTS.md e fontes lidos.
- [x] Requisito EARS ligado a D1.
- [x] Aceite Dado/Quando/Então com superfície.
- [x] Clarifications Needed = none.
- [x] Plan pode ser escrito sem decisão pendente.
- [x] Shared Contract = none.
- [x] Guardian aprovou a spec.`
  );
  writeFixture(
    path.join(featureDir, "plan.md"),
    `# ${title} Execution Plan

Status: ready
Spec: ./spec.md
Updated: 2099-01-01 00:02

## Readiness Gates
- [x] Spec pronta e guardian approved.
- [x] Clarificações = none.
- [x] Impact Map completo.
- [x] Harness concreto.
- [x] Guardian aprovou o plano.

## Impact Map
| ID | Surface | Evidence | Files | Change | Validation | Risk |
|---|---|---|---|---|---|---|
| I1 | filesystem | D1 | ${outputFile} | create | exact content | low |

## Phase 1
Status: pending

### Task 1.1
Status: pending
Owner/Subagent: unassigned
Write set: ${outputFile}
Requirement: I1
DoD: ${outputFile} contém uma linha ok
Validation: test "$(tr -d '\\n' < ${outputFile})" = "ok"
Evidence: pending
Blockers: none

## Guardian Review
Status: approved

## Execution Resume
- Last completed task: none
- Next task: 1.1
- Current blockers: none`
  );
  return featureDir;
}

function markExecutionFeatureDone(featureDir, outputFile) {
  const manifestPath = path.join(featureDir, "manifest.md");
  const planPath = path.join(featureDir, "plan.md");
  writeFixture(
    manifestPath,
    fs
      .readFileSync(manifestPath, "utf8")
      .replace(/^Status: ready$/m, "Status: done")
      .replace("- Plan: ready", "- Plan: done")
      .replace("- Next action: execute task 1.1", "- Next action: none")
  );
  writeFixture(
    planPath,
    fs
      .readFileSync(planPath, "utf8")
      .replace(/^Status: ready$/m, "Status: done")
      .replace("## Phase 1\nStatus: pending", "## Phase 1\nStatus: done")
      .replace(
        "### Task 1.1\nStatus: pending\nOwner/Subagent: unassigned",
        "### Task 1.1\nStatus: done\nOwner/Subagent: worker"
      )
      .replace("Evidence: pending", `Evidence: ${outputFile} contém ok`)
      .replace(
        "- Last completed task: none\n- Next task: 1.1",
        "- Last completed task: 1.1\n- Next task: none"
      )
  );
}

const hasPi = piAvailable();
const liveSkip = !hasPi
  ? "pi CLI not available"
  : process.env.PI_RUN_LIVE_CANARIES !== "1"
    ? "set PI_RUN_LIVE_CANARIES=1"
    : false;

test("pi CLI is available when explicitly required", () => {
  if (process.env.PI_REQUIRE_CLI === "1") assert.equal(hasPi, true, "pi CLI is required");
});

test("skills encode Pi subagent dispatch instead of assistant slash chaining", () => {
  for (const skill of EXPECTED_SKILLS) {
    const content = fs.readFileSync(path.join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    assert.doesNotMatch(content, /spawn_agent|inline por padrão no Pi/);
    if (WORKFLOW_SKILLS.includes(skill)) {
      assert.match(content, /## Runtime & Delegation/);
      assert.match(content, /\.\.\/\.\.\/references\/WORKFLOW_COMMON\.md/);
    }
  }
});

test(
  "Pi RPC discovers the package skills from their real files",
  { skip: !hasPi ? "pi CLI not available" : false },
  () => {
    const response = runRpc("get_commands");
    assert.equal(response.success, true);
    const commands = response.data.commands.filter((command) => command.source === "skill");
    assert.deepEqual(
      commands.map((command) => command.name.replace("skill:", "")).sort(),
      [...EXPECTED_SKILLS].sort()
    );
    for (const command of commands) {
      assert.equal(
        fs.realpathSync(command.sourceInfo.path),
        fs.realpathSync(path.join(ROOT, "skills", command.name.replace("skill:", ""), "SKILL.md"))
      );
    }
  }
);

test(
  "pi-subagents registers the workflow role agents",
  { skip: liveSkip },
  () => {
    const trace = runPi(
      "Inspect the Agent tool description/schema (it lists the available subagent types). Confirm which of these agent types exist: worker, delegate, workflow-validator, artifact-guardian. Reply done.",
      ROOT,
      180_000,
      "read,Agent"
    );
    maybeSaveEvidence("pi-subagents-agents.log", traceEvidence(trace));
    const calls = trace.toolCalls.filter((call) => call.name === "Agent");
    assert.ok(
      calls.some((call) => typeof call.arguments?.subagent_type === "string"),
      "Agent tool never used to inspect the type list"
    );
    const text = trace.text;
    for (const role of ["worker", "delegate", "workflow-validator", "artifact-guardian"]) {
      assert.match(text, new RegExp(role), `role ${role} not reported as available`);
    }
  }
);

test(
  "/skill:batista-spec asks a material persistence question instead of assuming",
  { skip: liveSkip },
  (t) => {
    const sandbox = createSandbox(t);
    const featureDir = path.join(sandbox, ".features", "2099-01-01_0000-account-deletion");
    const prompt = [
      `/skill:batista-spec ${featureDir}`,
      `Project root: ${sandbox}`,
      "Objetivo: permitir exclusão de conta.",
      "Decisão material ainda não tomada: hard-delete ou anonimização com retenção.",
      "Faça discovery mínimo e pergunte; não escolha por suposição.",
    ].join("\n");
    const trace = runPi(prompt, sandbox);
    maybeSaveEvidence("pi-spec-clarification.log", traceEvidence(trace));
    const spec = fs.readFileSync(path.join(featureDir, "spec.md"), "utf8");
    assert.match(trace.text, /C1|Clarifications Needed/i);
    assert.match(trace.text, /hard-delete|anonimi[sz]a(?:tion|ção)|reten(?:ção|tion)/i);
    assert.match(spec, /Status:\s*blocked/);
    const clarifications = spec.match(/## Clarifications Needed([\s\S]*?)(?=\n## |$)/)?.[1] || "";
    assert.match(clarifications, /C1/);
    assert.match(clarifications, /hard-delete|anonimi[sz]a(?:tion|ção)|reten(?:ção|tion)/i);
    const launches = subagentLaunches(trace);
    assert.equal(launches.length, 0);
    assert.equal(fs.existsSync(path.join(featureDir, "plan.md")), false);
    assert.equal(fs.existsSync(path.join(featureDir, "ux.md")), false);
    assert.equal(fs.existsSync(path.join(featureDir, "arch.md")), false);
    assert.deepEqual(fs.readdirSync(sandbox).sort(), [".features", "AGENTS.md"]);
  }
);

test(
  "/skill:batista-loop resumes the supplied epic instead of creating a replacement",
  { skip: liveSkip },
  (t) => {
    const sandbox = createSandbox(t);
    const epicDir = path.join(sandbox, ".features", "2099-01-01_0001-resume-loop");
    fs.mkdirSync(epicDir, { recursive: true });
    fs.writeFileSync(
      path.join(epicDir, "loop.md"),
      [
        "# Resume Loop",
        "",
        "Status: blocked",
        "Updated: 2099-01-01 00:01",
        "Iteration budget: 5",
        "Iterations used: 2",
        "",
        "## Objective",
        "- Resultado esperado: interface administrativa definida",
        "- Evidência de aceite: fluxo aprovado pelo usuário",
        "",
        "## Convergence Ledger",
        "- SENTINEL-PRESERVE | decisão pendente descoberta anteriormente",
        "",
        "## Resume Point",
        "- Próxima ação: perguntar CLI ou Web",
        "- Blockers: usuário ainda não escolheu CLI ou Web",
      ].join("\n")
    );
    const trace = runPi(`/skill:batista-loop ${epicDir}\nRetome exatamente este épico.`, sandbox);
    maybeSaveEvidence("pi-loop-resume.log", traceEvidence(trace));
    const loop = fs.readFileSync(path.join(epicDir, "loop.md"), "utf8");
    assert.match(trace.text, /CLI|Web/);
    assert.match(loop, /Status:\s*blocked/);
    assert.match(loop, /Iterations used:\s*2/);
    assert.match(loop, /SENTINEL-PRESERVE/);
    assert.match(loop, /Próxima ação:|Next action:[\s\S]*CLI[\s\S]*Web/i);
    const launches = subagentLaunches(trace);
    assert.equal(launches.length, 0);
    assert.equal(fs.readdirSync(path.join(sandbox, ".features")).length, 1);
  }
);

test(
  "/skill:batista-loop continues from execute pending through every sub-feature and root outcome",
  {
    skip:
      liveSkip ||
      (process.env.PI_RUN_LOOP_E2E !== "1" ? "set PI_RUN_LOOP_E2E=1" : false),
  },
  (t) => {
    const sandbox = createSandbox(t);
    const epicDir = path.join(sandbox, ".features", "2099-01-01_0002-auto-execute");
    const features = [
      { dirName: "fixture-a", title: "Fixture A", outputFile: "result-a.txt" },
      { dirName: "fixture-b", title: "Fixture B", outputFile: "result-b.txt" },
    ];
    writeFixture(
      path.join(epicDir, "loop.md"),
      `# Auto Execute — Loop

Status: running
Updated: 2099-01-01 00:02
Iteration budget: 5
Iterations used: 0

## Objective
- Resultado esperado: result-a.txt e result-b.txt existem com conteúdo exato ok
- Evidência de aceite: comandos test verificam ambos os conteúdos

## Strategy
- Decomposição: decomposed(2)
- Execução: sequential
- Racional: Fixture B depende da conclusão de Fixture A

## Sub-features
| Feature | Dir | Batch | Depends on | Write set | Worktree | manifest | execute | Verify | Status |
|---|---|---|---|---|---|---|---|---|---|
| Fixture A | ./fixture-a | B1 | none | result-a.txt | none | ready | pending | pending | running |
| Fixture B | ./fixture-b | B2 | Fixture A | result-b.txt | none | ready | pending | pending | pending |

## Convergence Ledger
- none

## Integration
- Merge: none
- E2E: pending

## Outcome Guardian
Status: pending

## Resume Point
- Última sub-feature concluída: none
- Próxima ação: executar Fixture A e continuar para Fixture B
- Blockers: none`
    );
    const featureDirs = features.map((feature) => writeReadyExecutionFeature(epicDir, feature));
    writeFixture(
      path.join(sandbox, ".pi", "subagents.json"),
      fs.readFileSync(path.join(ROOT, "examples", "subagents.json"), "utf8")
    );
    const git = (args) => {
      const result = spawnSync("git", args, { cwd: sandbox, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    };
    git(["init", "-q"]);
    git(["config", "user.email", "pi-test@example.invalid"]);
    git(["config", "user.name", "Pi Test"]);
    git(["add", "."]);
    git(["commit", "-qm", "fixture"]);

    const trace = runPi(
      `/skill:batista-loop ${epicDir}\nRetome e continue automaticamente até uma stop condition.`,
      sandbox,
      780_000,
      "read,write,edit,grep,find,ls,Agent,get_subagent_result,steer_subagent"
    );
    const loop = fs.readFileSync(path.join(epicDir, "loop.md"), "utf8");
    maybeSaveEvidence(
      "pi-loop-auto-execute.log",
      `${traceEvidence(trace)}\n--- loop.md ---\n${loop}`
    );
    const launches = subagentLaunches(trace);
    const firstLaunchIndex = trace.toolCalls.indexOf(launches[0]);
    for (const agent of ["worker", "workflow-validator", "artifact-guardian", "delegate"]) {
      const idx = agentPreflightIndex(trace, agent);
      assert.ok(
        idx >= 0 && idx < firstLaunchIndex,
        `missing preflight read of agents/${agent}.md before first dispatch`
      );
    }
    for (const agent of ["worker", "workflow-validator", "artifact-guardian"]) {
      assert.ok(
        launches.some((call) => call.arguments.subagent_type === agent),
        `missing ${agent}`
      );
    }
    assert.equal(
      launches.filter((call) => call.arguments.subagent_type === "delegate").length,
      0,
      "ready execution must not delegate root commands"
    );
    for (const call of launches) {
      assert.ok(
        call.arguments.inherit_context == null,
        "children must run with fresh context (no inherit_context)"
      );
      assert.ok(call.arguments.cwd == null, "cwd is inherited from the root session");
    }
    const workerCalls = launches.filter(
      (call) => call.arguments.subagent_type === "worker"
    );
    const validatorCalls = launches.filter(
      (call) => call.arguments.subagent_type === "workflow-validator"
    );
    assert.match(roleAgentFrontmatter("worker"), /model: deepseek\/deepseek-v4-flash/);
    assert.match(roleAgentFrontmatter("worker"), /thinking: off/);
    assert.match(roleAgentFrontmatter("workflow-validator"), /model: deepseek\/deepseek-v4-flash/);
    assert.match(roleAgentFrontmatter("workflow-validator"), /thinking: xhigh/);
    for (const call of workerCalls) {
      assert.ok(call.arguments.model == null, "worker model comes from frontmatter");
    }
    for (const call of validatorCalls) {
      assert.ok(call.arguments.model == null, "validator model comes from frontmatter");
    }
    const outcomeResults = launches
      .filter((call) => call.arguments.subagent_type === "artifact-guardian")
      .map((call) => toolResultText(trace, call));
    assert.ok(
      outcomeResults.every((result) => result.trim()),
      "outcome result must remain independently inspectable"
    );
    for (const result of outcomeResults) {
      assert.doesNotMatch(result, /\b(?:status|guardian):\s*(?:rejected|fail)\b/i);
      assert.ok(explicitlyApproves(result), "root outcome lacks positive approval");
    }
    const outcomeCalls = launches.filter(
      (call) => call.arguments.subagent_type === "artifact-guardian"
    );
    assert.equal(outcomeCalls.length, 1, "root outcome must run exactly once");
    assert.ok(
      outcomeCalls[0].arguments.model == null,
      "artifact-guardian inherits the session model"
    );
    const outcomeIndex = trace.toolCalls.indexOf(outcomeCalls[0]);
    let previousValidatorIndex = -1;
    for (const [featureIndex, { outputFile }] of features.entries()) {
      const featureWorkers = workerCalls.filter((call) =>
        String(call.arguments.prompt).includes(outputFile)
      );
      const featureValidators = validatorCalls.filter((call) =>
        String(call.arguments.prompt).includes(outputFile)
      );
      assert.ok(featureWorkers.length >= 1, `missing worker for ${outputFile}`);
      assert.ok(featureValidators.length >= 1, `missing validator for ${outputFile}`);
      assert.equal(
        featureValidators.length,
        featureWorkers.length,
        `worker/validator attempts are not paired for ${outputFile}`
      );
      const workerIndices = featureWorkers
        .map((call) => trace.toolCalls.indexOf(call))
        .sort((a, b) => a - b);
      const validatorIndices = featureValidators
        .map((call) => trace.toolCalls.indexOf(call))
        .sort((a, b) => a - b);
      const workerIndex = Math.min(...workerIndices);
      const validatorIndex = Math.max(...validatorIndices);
      assert.ok(previousValidatorIndex < workerIndex, `DAG order violated before ${outputFile}`);
      for (let attempt = 0; attempt < workerIndices.length; attempt += 1) {
        assert.ok(
          workerIndices[attempt] < validatorIndices[attempt],
          `validator preceded worker attempt ${attempt + 1} for ${outputFile}`
        );
        if (attempt + 1 < workerIndices.length) {
          assert.ok(
            validatorIndices[attempt] < workerIndices[attempt + 1],
            `retry worker lacks an intervening validator for ${outputFile}`
          );
          assert.match(
            toolResultText(trace, featureValidators[attempt]),
            /\b(?:status|guardian):\s*(?:rejected|fail)\b|\breprovad[oa]\b/i,
            `retry worker lacks a persisted rejection for ${outputFile}`
          );
        }
      }
      if (featureIndex > 0) {
        for (const file of [
          path.join(featureDirs[featureIndex - 1], "manifest.md"),
          path.join(featureDirs[featureIndex - 1], "plan.md"),
          path.join(epicDir, "loop.md"),
        ]) {
          assert.ok(
            trace.toolCalls.some(
              (call, index) =>
                index > previousValidatorIndex &&
                index < workerIndex &&
                call.name === "edit" &&
                path.resolve(call.arguments.path || "") === path.resolve(file)
            ),
            `previous sub-feature was not persisted before ${outputFile}: ${file}`
          );
        }
      }
      const finalValidatorResult = toolResultText(
        trace,
        featureValidators[validatorIndices.indexOf(validatorIndex)]
      );
      assert.ok(finalValidatorResult.trim(), `final validator returned no result for ${outputFile}`);
      assert.doesNotMatch(
        finalValidatorResult,
        /\b(?:status|guardian):\s*(?:rejected|fail)\b/i
      );
      assert.ok(
        validatorResultApproves(trace, featureValidators[validatorIndices.indexOf(validatorIndex)]),
        `final validator lacks positive approval for ${outputFile}`
      );
      previousValidatorIndex = validatorIndex;
      assert.match(String(outcomeCalls[0].arguments.prompt), new RegExp(outputFile.replace(".", "\\.")));
    }
    assert.ok(previousValidatorIndex < outcomeIndex, "root outcome ran before all validators");
    assert.equal(
      launches.indexOf(outcomeCalls[0]),
      launches.findLastIndex((call) => call.arguments.subagent_type === "workflow-validator") + 1,
      "root-only phase launched a child before the outcome guardian"
    );
    for (const call of [...workerCalls, ...validatorCalls]) {
      const referencedOutputs = features.filter(({ outputFile }) =>
        String(call.arguments.prompt).includes(outputFile)
      );
      assert.equal(referencedOutputs.length, 1, `${call.arguments.subagent_type} escaped one sub-feature`);
    }
    const workflowWriteSet = new Set([
      path.resolve(epicDir, "loop.md"),
      ...featureDirs.flatMap((featureDir) => [
        path.resolve(featureDir, "manifest.md"),
        path.resolve(featureDir, "plan.md"),
      ]),
    ]);
    for (const call of trace.toolCalls.filter((item) => ["write", "edit"].includes(item.name))) {
      assert.ok(
        workflowWriteSet.has(path.resolve(call.arguments.path || "")),
        `manager wrote outside workflow docs: ${call.arguments.path}`
      );
    }
    const changed = spawnSync(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      { cwd: sandbox, encoding: "utf8" }
    );
    assert.equal(changed.status, 0, changed.stderr);
    const allowedChanges = new Set([
      path.relative(sandbox, path.join(epicDir, "loop.md")),
      ...featureDirs.flatMap((featureDir) => [
        path.relative(sandbox, path.join(featureDir, "manifest.md")),
        path.relative(sandbox, path.join(featureDir, "plan.md")),
      ]),
      ...features.map(({ outputFile }) => outputFile),
    ]);
    for (const line of changed.stdout.trim().split("\n").filter(Boolean)) {
      const changedPath = line.slice(3).trim();
      if (changedPath.startsWith(".pi-subagents/")) continue;
      assert.ok(allowedChanges.has(changedPath), `worker escaped write set: ${changedPath}`);
    }
    for (const call of trace.toolCalls.filter((item) => item.name === "bash")) {
      const command = String(call.arguments.command || call.arguments.cmd || "");
      const commandWithoutNullRedirects = command.replace(/\d*>\/dev\/null\b/g, "");
      assert.doesNotMatch(
        commandWithoutNullRedirects,
        /\b(?:touch|truncate|tee|rm|mv|cp|install|mkdir)\b|\b(?:sed\s+-i|perl|python|node)\b|(^|[^<])>(?![=>]|&\d)/,
        `manager used mutation-capable bash: ${command}`
      );
    }
    const checkpointFiles = [
      path.resolve(epicDir, "loop.md"),
      ...featureDirs.flatMap((featureDir) => [
        path.resolve(featureDir, "manifest.md"),
        path.resolve(featureDir, "plan.md"),
      ]),
      ...features.map(({ outputFile }) => path.resolve(sandbox, outputFile)),
    ];
    const checkpointReads = checkpointFiles.map((file) =>
      trace.toolCalls.findLastIndex(
        (call, index) =>
          index < outcomeIndex &&
          call.name === "read" &&
          path.resolve(call.arguments.path || "") === file
      )
    );
    assert.ok(checkpointReads.every((index) => index >= 0), "checkpoint missed workflow docs");
    const lastInvalidator = trace.toolCalls.findLastIndex(
      (call, index) =>
        index < outcomeIndex &&
        (["write", "edit", "bash"].includes(call.name) ||
          (call.name === "Agent" && !!call.arguments.subagent_type))
    );
    assert.ok(
      Math.min(...checkpointReads) > lastInvalidator,
      "checkpoint reads must follow the last mutation or child"
    );
    assert.equal(
      Math.max(...checkpointReads) + 1,
      outcomeIndex,
      "root outcome must immediately follow the clean checkpoint"
    );
    for (const call of trace.toolCalls.slice(outcomeIndex + 1)) {
      if (["write", "edit"].includes(call.name)) {
        assert.equal(
          path.resolve(call.arguments.path || ""),
          path.resolve(epicDir, "loop.md"),
          "post-outcome mutation invalidated reviewed artifacts"
        );
      }
      assert.ok(
        call.name !== "Agent" || !call.arguments.subagent_type,
        "post-outcome child invalidated the root approval"
      );
    }
    assert.equal(loop.match(/^Status:\s*(\S+)/m)?.[1], "converged");
    assert.match(loop, /^Iterations used:\s*0$/m);
    assert.doesNotMatch(loop, /^\s*-\s*0\s*\|\s*gap:\s*none/m);
    const rows = loop
      .match(/## Sub-features([\s\S]*?)(?=\n## )/)[1]
      .match(/^\|.*\|$/gm)
      .slice(2);
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.match(row, /\|\s*done\s*\|\s*done\s*\|\s*pass\s*\|\s*done\s*\|\s*$/);
    }
    const integration = loop.match(/## Integration([\s\S]*?)(?=\n## )/)?.[1] || "";
    assert.match(integration, /^- E2E:\s*(?!pending|none).+/im);
    assert.match(integration, /result-a\.txt/i);
    assert.match(integration, /result-b\.txt/i);
    assert.match(integration, /\bok\b/i);
    const outcome = loop.match(/## Outcome Guardian([\s\S]*?)(?=\n## )/)[1];
    assert.equal(outcome.match(/^Status:\s*(\S+)/m)?.[1], "approved");
    const outcomeArtifact = outcome.match(/^Artifact:\s*(.+)$/m)?.[1]?.trim();
    assert.ok(outcomeArtifact, "root outcome artifact missing");
    assert.equal(
      path.resolve(sandbox, outcomeArtifact),
      path.resolve(epicDir, "loop.md"),
      "root outcome points to a different artifact"
    );
    assert.match(outcome, /Iteration:\s*0/);
    const outcomeEvidence = outcome.match(/^Evidence:\s*(.+)$/m)?.[1]?.trim();
    assert.ok(outcomeEvidence, "root outcome evidence missing");
    assert.doesNotMatch(outcomeEvidence, /^(?:pending|none)$/i);
    for (const [index, featureDir] of featureDirs.entries()) {
      const manifest = fs.readFileSync(path.join(featureDir, "manifest.md"), "utf8");
      const plan = fs.readFileSync(path.join(featureDir, "plan.md"), "utf8");
      const state = manifest.match(/## State([\s\S]*?)(?=\n## )/)?.[1] || "";
      const phase = plan.match(/## Phase 1([\s\S]*?)(?=\n## |$)/)?.[1] || "";
      const task = plan.match(/### Task 1\.1([\s\S]*?)(?=\n### |\n## |$)/)?.[1] || "";
      assert.equal(
        fs.readFileSync(path.join(sandbox, features[index].outputFile), "utf8").trim(),
        "ok"
      );
      assert.equal(manifest.match(/^Status:\s*(\S+)/m)?.[1], "done");
      assert.equal(plan.match(/^Status:\s*(\S+)/m)?.[1], "done");
      assert.match(state, /^- Plan:\s*done$/m);
      assert.equal(phase.match(/^Status:\s*(\S+)/m)?.[1], "done");
      assert.equal(task.match(/^Status:\s*(\S+)/m)?.[1], "done");
      const taskEvidence = task.match(/^Evidence:\s*(.+)$/m)?.[1]?.trim();
      assert.ok(taskEvidence, `task evidence missing: ${features[index].outputFile}`);
      assert.doesNotMatch(taskEvidence, /^(?:pending|none)$/i);
      assert.match(manifest, /^- Next action:\s*none\b/m);
      assert.match(plan, /^- Next task:\s*none\b/m);
    }
    assert.doesNotMatch(trace.text, /fale.*execute|execute a Fase|delegar .*\/skill:batista-execute/i);
  }
);

test(
  "/skill:batista-loop resumes after completed sub-feature without reopening it",
  {
    skip:
      liveSkip ||
      (process.env.PI_RUN_LOOP_E2E !== "1" ? "set PI_RUN_LOOP_E2E=1" : false),
  },
  (t) => {
    const sandbox = createSandbox(t);
    const epicDir = path.join(sandbox, ".features", "2099-01-01_0003-resume-execute");
    const features = [
      { dirName: "fixture-a", title: "Fixture A", outputFile: "result-a.txt" },
      { dirName: "fixture-b", title: "Fixture B", outputFile: "result-b.txt" },
    ];
    writeFixture(
      path.join(epicDir, "loop.md"),
      `# Resume Execute — Loop

Status: running
Updated: 2099-01-01 00:02
Iteration budget: 5
Iterations used: 0

## Objective
- Resultado esperado: result-a.txt e result-b.txt existem com conteúdo exato ok
- Evidência de aceite: comandos test verificam ambos os conteúdos

## Strategy
- Decomposição: decomposed(2)
- Execução: sequential
- Racional: Fixture B depende da conclusão de Fixture A

## Sub-features
| Feature | Dir | Batch | Depends on | Write set | Worktree | manifest | execute | Verify | Status |
|---|---|---|---|---|---|---|---|---|---|
| Fixture A | ./fixture-a | B1 | none | result-a.txt | none | done | done | pass | done |
| Fixture B | ./fixture-b | B2 | Fixture A | result-b.txt | none | ready | pending | pending | pending |

## Convergence Ledger
- none

## Integration
- Merge: none
- E2E: pending

## Outcome Guardian
Status: pending

## Resume Point
- Última sub-feature concluída: Fixture A
- Próxima ação: executar Fixture B
- Blockers: none`
    );
    const featureDirs = features.map((feature) => writeReadyExecutionFeature(epicDir, feature));
    markExecutionFeatureDone(featureDirs[0], "result-a.txt");
    writeFixture(path.join(sandbox, "result-a.txt"), "ok");
    const completedManifest = fs.readFileSync(path.join(featureDirs[0], "manifest.md"), "utf8");
    const completedPlan = fs.readFileSync(path.join(featureDirs[0], "plan.md"), "utf8");
    writeFixture(
      path.join(sandbox, ".pi", "subagents.json"),
      fs.readFileSync(path.join(ROOT, "examples", "subagents.json"), "utf8")
    );
    const git = (args) => {
      const result = spawnSync("git", args, { cwd: sandbox, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    };
    git(["init", "-q"]);
    git(["config", "user.email", "pi-test@example.invalid"]);
    git(["config", "user.name", "Pi Test"]);
    git(["add", "."]);
    git(["commit", "-qm", "fixture"]);

    const trace = runPi(
      `/skill:batista-loop ${epicDir}\nRetome do estado persistido e continue automaticamente até uma stop condition.`,
      sandbox,
      600_000,
      "read,write,edit,grep,find,ls,Agent,get_subagent_result,steer_subagent"
    );
    const loop = fs.readFileSync(path.join(epicDir, "loop.md"), "utf8");
    maybeSaveEvidence(
      "pi-loop-resume-completed.log",
      `${traceEvidence(trace)}\n--- loop.md ---\n${loop}`
    );
    const launches = subagentLaunches(trace);
    for (const call of launches) {
      const dispatch = effectiveDispatch(trace, call);
      assert.ok(
        call.arguments.inherit_context == null,
        "children must run with fresh context (no inherit_context)"
      );
      assert.ok(call.arguments.cwd == null, "cwd is inherited from the root session");
      assert.ok(dispatch != null);
    }
    for (const agent of ["worker", "workflow-validator"]) {
      const calls = launches.filter((call) => call.arguments.subagent_type === agent);
      assert.ok(calls.some((call) => String(call.arguments.prompt).includes("result-b.txt")));
      assert.ok(calls.every((call) => !String(call.arguments.prompt).includes("result-a.txt")));
    }
    assert.match(roleAgentFrontmatter("worker"), /model: deepseek\/deepseek-v4-flash/);
    assert.match(roleAgentFrontmatter("workflow-validator"), /thinking: xhigh/);
    for (const call of launches.filter((item) => item.arguments.subagent_type === "worker")) {
      assert.ok(call.arguments.model == null, "worker model comes from frontmatter");
    }
    for (const call of launches.filter(
      (item) => item.arguments.subagent_type === "workflow-validator"
    )) {
      assert.ok(call.arguments.model == null, "validator model comes from frontmatter");
      assert.ok(validatorResultApproves(trace, call));
    }
    assert.equal(launches.filter((call) => call.arguments.subagent_type === "delegate").length, 0);
    const outcomeCalls = launches.filter(
      (call) => call.arguments.subagent_type === "artifact-guardian"
    );
    assert.equal(outcomeCalls.length, 1);
    assert.ok(outcomeCalls[0].arguments.model == null, "guardian inherits the session model");
    assert.ok(explicitlyApproves(toolResultText(trace, outcomeCalls[0])));
    const allowedManagerWrites = new Set([
      path.resolve(epicDir, "loop.md"),
      path.resolve(featureDirs[1], "manifest.md"),
      path.resolve(featureDirs[1], "plan.md"),
    ]);
    for (const call of trace.toolCalls.filter((item) => ["write", "edit"].includes(item.name))) {
      assert.ok(
        allowedManagerWrites.has(path.resolve(call.arguments.path || "")),
        `resume manager wrote outside pending workflow docs: ${call.arguments.path}`
      );
    }
    assert.equal(
      fs.readFileSync(path.join(featureDirs[0], "manifest.md"), "utf8"),
      completedManifest
    );
    assert.equal(fs.readFileSync(path.join(featureDirs[0], "plan.md"), "utf8"), completedPlan);
    assert.equal(fs.readFileSync(path.join(sandbox, "result-a.txt"), "utf8").trim(), "ok");
    assert.equal(fs.readFileSync(path.join(sandbox, "result-b.txt"), "utf8").trim(), "ok");
    assert.equal(loop.match(/^Status:\s*(\S+)/m)?.[1], "converged");
    assert.match(loop, /^Iterations used:\s*0$/m);
    assert.match(
      loop,
      /^\| Fixture A .*\|\s*done\s*\|\s*done\s*\|\s*pass\s*\|\s*done\s*\|$/m
    );
    assert.match(
      loop,
      /^\| Fixture B .*\|\s*done\s*\|\s*done\s*\|\s*pass\s*\|\s*done\s*\|$/m
    );
    const completedBManifest = fs.readFileSync(path.join(featureDirs[1], "manifest.md"), "utf8");
    const completedBPlan = fs.readFileSync(path.join(featureDirs[1], "plan.md"), "utf8");
    assert.equal(completedBManifest.match(/^Status:\s*(\S+)/m)?.[1], "done");
    assert.match(completedBManifest, /^- Plan:\s*done$/m);
    assert.equal(completedBPlan.match(/^Status:\s*(\S+)/m)?.[1], "done");
    const outcome = loop.match(/## Outcome Guardian([\s\S]*?)(?=\n## )/)?.[1] || "";
    assert.equal(outcome.match(/^Status:\s*(\S+)/m)?.[1], "approved");
  }
);

test(
  "/skill:batista-loop recovers from a rejected root outcome through a persisted correction",
  {
    skip:
      liveSkip ||
      (process.env.PI_RUN_LOOP_E2E !== "1" ? "set PI_RUN_LOOP_E2E=1" : false),
  },
  (t) => {
    const sandbox = createSandbox(t);
    const epicDir = path.join(sandbox, ".features", "2099-01-01_0004-root-correction");
    const feature = {
      dirName: "fixture-a",
      title: "Fixture A",
      outputFile: "result-a.txt",
    };
    writeFixture(
      path.join(epicDir, "loop.md"),
      `# Root Correction — Loop

Status: running
Updated: 2099-01-01 00:04
Iteration budget: 5
Iterations used: 0

## Objective
- Resultado esperado: result-a.txt existe com conteúdo exato ok
- Evidência de aceite: test verifica o conteúdo exato

## Strategy
- Decomposição: single(1)
- Execução: sequential
- Racional: uma task existente é responsável pelo resultado

## Sub-features
| Feature | Dir | Batch | Depends on | Write set | Worktree | manifest | execute | Verify | Status |
|---|---|---|---|---|---|---|---|---|---|
| Fixture A | ./fixture-a | B1 | none | result-a.txt | none | done | done | pass | done |

## Convergence Ledger
- none

## Integration
- Merge: none
- E2E: fail — result-a.txt contém bad, esperado ok

## Outcome Guardian
Status: rejected
Artifact: .features/2099-01-01_0004-root-correction/loop.md
Iteration: 0
Evidence: result-a.txt contém bad, esperado ok
- fail — conteúdo exato — result-a.txt

## Resume Point
- Última sub-feature concluída: Fixture A
- Próxima ação: corrigir o gap raiz na Task 1.1 de Fixture A
- Blockers: none`
    );
    const featureDir = writeReadyExecutionFeature(epicDir, feature);
    markExecutionFeatureDone(featureDir, feature.outputFile);
    writeFixture(path.join(sandbox, feature.outputFile), "bad");
    writeFixture(
      path.join(sandbox, ".pi", "subagents.json"),
      fs.readFileSync(path.join(ROOT, "examples", "subagents.json"), "utf8")
    );
    const git = (args) => {
      const result = spawnSync("git", args, { cwd: sandbox, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    };
    git(["init", "-q"]);
    git(["config", "user.email", "pi-test@example.invalid"]);
    git(["config", "user.name", "Pi Test"]);
    git(["add", "."]);
    git(["commit", "-qm", "fixture"]);

    const trace = runPi(
      `/skill:batista-loop ${epicDir}\nRetome o outcome rejeitado, corrija a menor task e continue automaticamente até uma stop condition.`,
      sandbox,
      Number(process.env.PI_ROOT_CORRECTION_TIMEOUT || 600_000),
      "read,write,edit,grep,find,ls,Agent,get_subagent_result,steer_subagent"
    );
    const loop = fs.readFileSync(path.join(epicDir, "loop.md"), "utf8");
    maybeSaveEvidence(
      "pi-loop-root-correction.log",
      `${traceEvidence(trace)}\n--- loop.md ---\n${loop}`
    );
    const launches = subagentLaunches(trace);
    const firstLaunchIndex = trace.toolCalls.indexOf(launches[0]);
    for (const agent of ["worker", "workflow-validator", "artifact-guardian", "delegate"]) {
      const idx = agentPreflightIndex(trace, agent);
      assert.ok(
        idx >= 0 && idx < firstLaunchIndex,
        `missing preflight read of agents/${agent}.md before first dispatch`
      );
    }
    const worker = launches.find(
      (call) =>
        call.arguments.subagent_type === "worker" &&
        String(call.arguments.prompt).includes(feature.outputFile)
    );
    const validator = launches.find(
      (call) =>
        call.arguments.subagent_type === "workflow-validator" &&
        String(call.arguments.prompt).includes(feature.outputFile)
    );
    assert.ok(worker, "root correction did not dispatch a worker");
    assert.ok(validator, "root correction did not dispatch a validator");
    assert.equal(
      launches[launches.indexOf(worker) + 1],
      validator,
      "root correction launched another child between worker and validator"
    );
    assert.match(roleAgentFrontmatter("worker"), /model: deepseek\/deepseek-v4-flash/);
    assert.match(roleAgentFrontmatter("worker"), /thinking: off/);
    assert.match(roleAgentFrontmatter("workflow-validator"), /model: deepseek\/deepseek-v4-flash/);
    assert.match(roleAgentFrontmatter("workflow-validator"), /thinking: xhigh/);
    assert.ok(worker.arguments.model == null, "worker model comes from frontmatter");
    assert.ok(validator.arguments.model == null, "validator model comes from frontmatter");
    assert.ok(worker.arguments.inherit_context == null, "worker runs with fresh context");
    assert.ok(validator.arguments.inherit_context == null, "validator runs with fresh context");
    assert.ok(worker.arguments.cwd == null, "cwd is inherited from the root session");
    assert.ok(validator.arguments.cwd == null, "cwd is inherited from the root session");
    assert.ok(validatorResultApproves(trace, validator));
    const outcomeCalls = launches.filter(
      (call) => call.arguments.subagent_type === "artifact-guardian"
    );
    assert.equal(outcomeCalls.length, 1);
    assert.ok(
      outcomeCalls[0].arguments.model == null,
      "artifact-guardian inherits the session model"
    );
    assert.ok(explicitlyApproves(toolResultText(trace, outcomeCalls[0])));
    const outcomeIndex = trace.toolCalls.indexOf(outcomeCalls[0]);
    const workflowWriteSet = new Set([
      path.resolve(epicDir, "loop.md"),
      path.resolve(featureDir, "manifest.md"),
      path.resolve(featureDir, "plan.md"),
    ]);
    for (const call of trace.toolCalls.filter((item) => ["write", "edit"].includes(item.name))) {
      assert.ok(
        workflowWriteSet.has(path.resolve(call.arguments.path || "")),
        `root manager wrote product directly: ${call.arguments.path}`
      );
    }
    const workerIndex = trace.toolCalls.indexOf(worker);
    for (const file of [
      path.join(epicDir, "loop.md"),
      path.join(featureDir, "manifest.md"),
      path.join(featureDir, "plan.md"),
    ]) {
      assert.ok(
        trace.toolCalls.some(
          (call, index) =>
            index < workerIndex &&
            ["write", "edit"].includes(call.name) &&
            path.resolve(call.arguments.path || "") === path.resolve(file)
        ),
        `root correction was not persisted before worker: ${file}`
      );
    }
    const preWorkerLoopEdits = trace.toolCalls
      .slice(0, workerIndex)
      .filter(
        (call) =>
          ["write", "edit"].includes(call.name) &&
          path.resolve(call.arguments.path || "") === path.resolve(epicDir, "loop.md")
      );
    assert.match(JSON.stringify(preWorkerLoopEdits), /execute=fail|\| fail \| pending \| running/);
    const preWorkerMutations = JSON.stringify(trace.toolCalls.slice(0, workerIndex));
    assert.match(preWorkerMutations, /Plan:\s*ready/);
    assert.doesNotMatch(preWorkerMutations, /Plan:\s*pending|Guardian Review\\nStatus:\s*pending/);
    const checkpointFiles = [
      path.resolve(epicDir, "loop.md"),
      path.resolve(featureDir, "manifest.md"),
      path.resolve(featureDir, "plan.md"),
      path.resolve(sandbox, feature.outputFile),
    ];
    const checkpointReads = checkpointFiles.map((file) =>
      trace.toolCalls.findLastIndex(
        (call, index) =>
          index < outcomeIndex &&
          call.name === "read" &&
          path.resolve(call.arguments.path || "") === file
      )
    );
    assert.ok(checkpointReads.every((index) => index >= 0));
    const lastInvalidator = trace.toolCalls.findLastIndex(
      (call, index) =>
        index < outcomeIndex &&
        (["write", "edit", "bash"].includes(call.name) ||
          (call.name === "Agent" && !!call.arguments.subagent_type))
    );
    assert.ok(Math.min(...checkpointReads) > lastInvalidator);
    assert.equal(Math.max(...checkpointReads) + 1, outcomeIndex);
    assert.equal(fs.readFileSync(path.join(sandbox, feature.outputFile), "utf8").trim(), "ok");
    assert.equal(loop.match(/^Status:\s*(\S+)/m)?.[1], "converged");
    assert.match(loop, /^Iterations used:\s*1$/m);
    assert.match(loop, /^\s*-\s*(?:it\.?)?1\s*\|.+gap:.+causa:/im);
    assert.match(
      loop,
      /^\| Fixture A .*\|\s*done\s*\|\s*done\s*\|\s*pass\s*\|\s*done\s*\|$/m
    );
    const outcome = loop.match(/## Outcome Guardian([\s\S]*?)(?=\n## )/)?.[1] || "";
    assert.equal(outcome.match(/^Status:\s*(\S+)/m)?.[1], "approved");
    assert.match(outcome, /^Iteration:\s*1$/m);
  }
);
