const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const WT_SCRIPT_SOURCE = path.resolve(__dirname, "../skills/batista-worktree/scripts/wt.sh");

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function parseEnv(envContent) {
  const result = {};
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx);
      let val = trimmed.slice(eqIdx + 1);
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

describe("wt.sh functional test suite", () => {
  let tmpRoot;
  let repoDir;
  let wtScript;

  before(() => {
    // 1. Criar repositório git temporário de teste em os.tmpdir()
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
    repoDir = path.join(tmpRoot, "main-repo");
    fs.mkdirSync(repoDir, { recursive: true });

    // Inicializa repositório git
    run("git", ["init", "-b", "main"], { cwd: repoDir });
    run("git", ["config", "user.name", "Test User"], { cwd: repoDir });
    run("git", ["config", "user.email", "test@example.com"], { cwd: repoDir });

    // Copia wt.sh para o repositório temporário
    const scriptsDir = path.join(repoDir, "scripts");
    fs.mkdirSync(scriptsDir, { recursive: true });
    wtScript = path.join(scriptsDir, "wt.sh");
    fs.copyFileSync(WT_SCRIPT_SOURCE, wtScript);
    fs.chmodSync(wtScript, 0o755);

    // Cria commit inicial no main
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Test Repo\n");
    run("git", ["add", "."], { cwd: repoDir });
    run("git", ["commit", "-m", "initial commit"], { cwd: repoDir });
  });

  after(() => {
    // Limpeza do diretório temporário
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test("1. wt.sh init [slot] gera .env.worktree com variáveis corretas", () => {
    // Teste init com slot explícito
    const output = run(wtScript, ["init", "3"], { cwd: repoDir });
    assert.match(output, /Ambiente isolado inicializado no slot 3/);

    const envPath = path.join(repoDir, ".env.worktree");
    assert.ok(fs.existsSync(envPath), ".env.worktree deve existir");

    const env = parseEnv(fs.readFileSync(envPath, "utf8"));
    assert.equal(env.WORKTREE_SLOT, "3");
    assert.equal(env.PORT_OFFSET, "300");
    assert.equal(env.PORT, "3300");
    assert.equal(env.DB_DRIVER, "sqlite");
    assert.equal(env.DB_FILE, path.join(repoDir, ".tmp/dev.sqlite"));
    assert.equal(env.DATABASE_URL, `file:${path.join(repoDir, ".tmp/dev.sqlite")}`);
    assert.equal(env.SQLITE_URL, `sqlite:///${path.join(repoDir, ".tmp/dev.sqlite")}`);
    assert.ok(fs.existsSync(path.join(repoDir, ".tmp")), "diretório .tmp deve existir");
  });

  test("2. wt.sh init sem slot aloca o próximo slot disponível", () => {
    // Sobrescreve com init automático
    run(wtScript, ["init"], { cwd: repoDir });
    const envPath = path.join(repoDir, ".env.worktree");
    const env = parseEnv(fs.readFileSync(envPath, "utf8"));
    assert.equal(env.WORKTREE_SLOT, "1");
    assert.equal(env.PORT_OFFSET, "100");
    assert.equal(env.PORT, "3100");
    assert.equal(env.DB_DRIVER, "sqlite");
    assert.equal(env.DATABASE_URL, `file:${path.join(repoDir, ".tmp/dev.sqlite")}`);
  });

  test("3. wt.sh create <branch> <dir> cria git worktree com .env.worktree gerado", () => {
    const featureDir = path.join(tmpRoot, "feature-login");
    const output = run(wtScript, ["create", "feature/login", featureDir], { cwd: repoDir });
    assert.match(output, /Criando worktree para branch 'feature\/login'/);
    assert.match(output, /Worktree configurado em/);

    assert.ok(fs.existsSync(featureDir), "Diretório do worktree deve ter sido criado");
    const featureEnvPath = path.join(featureDir, ".env.worktree");
    assert.ok(fs.existsSync(featureEnvPath), ".env.worktree do worktree deve existir");

    const env = parseEnv(fs.readFileSync(featureEnvPath, "utf8"));
    // Como o repoDir tem slot 1, o próximo deve ser 2
    assert.equal(env.WORKTREE_SLOT, "2");
    assert.equal(env.PORT_OFFSET, "200");
    assert.equal(env.PORT, "3200");
    assert.equal(env.DB_DRIVER, "sqlite");
    assert.equal(env.DB_FILE, path.join(featureDir, ".tmp/dev.sqlite"));
    assert.equal(env.DATABASE_URL, `file:${path.join(featureDir, ".tmp/dev.sqlite")}`);
    assert.equal(env.SQLITE_URL, `sqlite:///${path.join(featureDir, ".tmp/dev.sqlite")}`);
  });

  test("4. wt.sh status lista os worktrees e slots", () => {
    const output = run(wtScript, ["status"], { cwd: repoDir });
    assert.match(output, /Worktrees Ativos e Status SQLite/);
    assert.match(output, /main-repo/);
    assert.match(output, /feature-login/);
    assert.match(output, /feature\/login/);
  });

  test("5. wt.sh db reset recria o arquivo .tmp/dev.sqlite", () => {
    const dbFile = path.join(repoDir, ".tmp/dev.sqlite");
    // Escreve conteúdo fictício
    fs.writeFileSync(dbFile, "TEST_DATA");
    assert.equal(fs.readFileSync(dbFile, "utf8"), "TEST_DATA");

    const output = run(wtScript, ["db", "reset"], { cwd: repoDir });
    assert.match(output, /Banco SQLite resetado em/);
    assert.ok(fs.existsSync(dbFile), "Arquivo .tmp/dev.sqlite deve existir após reset");
    assert.equal(fs.readFileSync(dbFile, "utf8"), "", "Arquivo deve estar vazio após reset");
  });

  test("6. wt.sh remove <dir> remove o worktree e limpa arquivos SQLite", () => {
    const featureDir = path.join(tmpRoot, "feature-login");
    // Cria um arquivo sqlite e arquivos WAL/SHM dentro do worktree para garantir remoção completa
    fs.writeFileSync(path.join(featureDir, ".tmp/dev.sqlite"), "MOCK DB");
    fs.writeFileSync(path.join(featureDir, ".tmp/dev.sqlite-wal"), "MOCK WAL");
    fs.writeFileSync(path.join(featureDir, ".tmp/dev.sqlite-shm"), "MOCK SHM");

    const output = run(wtScript, ["remove", featureDir], { cwd: repoDir });
    assert.match(output, /Limpando arquivos temporários SQLite/);
    assert.match(output, /Removendo git worktree/);
    assert.match(output, /Worktree removido com sucesso/);

    assert.ok(!fs.existsSync(featureDir), "Diretório do worktree deve ter sido removido");

    // Verifica se não aparece mais no status
    const statusOutput = run(wtScript, ["status"], { cwd: repoDir });
    assert.doesNotMatch(statusOutput, /feature-login/);
  });

  test("7. wt.sh db migrate executa fallback de criação do dev.sqlite sem ORM", () => {
    const dbFile = path.join(repoDir, ".tmp/dev.sqlite");
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }

    const output = run(wtScript, ["db", "migrate"], { cwd: repoDir });
    assert.match(output, /Executando migrações SQLite/);
    assert.match(output, /Nenhum orm conhecido configurado/);
    assert.ok(fs.existsSync(dbFile), "Arquivo .tmp/dev.sqlite deve ser criado pelo migrate");
  });

  test("8. wt.sh create em branch já existente e alias 'rm'", () => {
    run("git", ["branch", "feature/existing-branch"], { cwd: repoDir });

    const existingDir = path.join(tmpRoot, "feature-existing");
    const createOutput = run(wtScript, ["create", "feature/existing-branch", existingDir], { cwd: repoDir });
    assert.match(createOutput, /Criando worktree para branch 'feature\/existing-branch'/);
    assert.ok(fs.existsSync(existingDir), "Diretório do worktree deve existir");

    const rmOutput = run(wtScript, ["rm", existingDir], { cwd: repoDir });
    assert.match(rmOutput, /Worktree removido com sucesso/);
    assert.ok(!fs.existsSync(existingDir), "Diretório deve ter sido removido");
  });

  test("9. Validação de erros e argumentos obrigatórios", () => {
    assert.throws(
      () => run(wtScript, ["create"], { cwd: repoDir }),
      (err) => {
        assert.match(err.stderr || err.stdout, /Erro: Nome da branch obrigatório/);
        return true;
      }
    );

    assert.throws(
      () => run(wtScript, ["remove"], { cwd: repoDir }),
      (err) => {
        assert.match(err.stderr || err.stdout, /Erro: Caminho do diretório do worktree obrigatório/);
        return true;
      }
    );

    assert.throws(
      () => run(wtScript, ["invalid-cmd"], { cwd: repoDir }),
      (err) => {
        assert.match(err.stderr || err.stdout, /Comando desconhecido: invalid-cmd/);
        return true;
      }
    );

    assert.throws(
      () => run(wtScript, ["db", "invalid-action"], { cwd: repoDir }),
      (err) => {
        assert.match(err.stderr || err.stdout, /Subcomando inválido para db: invalid-action/);
        return true;
      }
    );
  });

  test("10. wt.sh help exibe instruções de uso", () => {
    const helpOutput = run(wtScript, ["help"], { cwd: repoDir });
    assert.match(helpOutput, /Uso do wt.sh:/);
    assert.match(helpOutput, /init/);
    assert.match(helpOutput, /create/);
    assert.match(helpOutput, /remove/);
    assert.match(helpOutput, /status/);
    assert.match(helpOutput, /db reset/);
    assert.match(helpOutput, /db migrate/);
  });

  test("11. wt.sh find_next_slot preenche lacunas de slots liberados", () => {
    const wt2Dir = path.join(tmpRoot, "wt-slot-2");
    const wt3Dir = path.join(tmpRoot, "wt-slot-3");

    run(wtScript, ["create", "branch-slot-2", wt2Dir], { cwd: repoDir });
    run(wtScript, ["create", "branch-slot-3", wt3Dir], { cwd: repoDir });

    // Remove wt2Dir (liberando o slot 2)
    run(wtScript, ["remove", wt2Dir], { cwd: repoDir });

    // Novo worktree deve reutilizar o menor slot vago (slot 2)
    const wtNewDir = path.join(tmpRoot, "wt-slot-new");
    run(wtScript, ["create", "branch-slot-new", wtNewDir], { cwd: repoDir });

    const newEnv = parseEnv(fs.readFileSync(path.join(wtNewDir, ".env.worktree"), "utf8"));
    assert.equal(newEnv.WORKTREE_SLOT, "2", "Deve reutilizar o slot 2 vago");

    // Limpeza
    run(wtScript, ["remove", wt3Dir], { cwd: repoDir });
    run(wtScript, ["remove", wtNewDir], { cwd: repoDir });
  });
});
