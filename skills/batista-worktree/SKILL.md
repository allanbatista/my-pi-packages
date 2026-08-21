---
name: batista-worktree
description: Orquestra e gerencia múltiplos Git worktrees para desenvolvimento paralelo de subagents usando SQLite isolado por worktree em vez de PostgreSQL/Docker, com alocação de portas e env local (.env.worktree).
---

# Batista Worktree - Isolamento de Worktrees com SQLite

Esta skill fornece o padrão e a ferramenta CLI (`scripts/wt.sh`) para permitir a execução paralela de subagentes em Git worktrees isolados, eliminando a necessidade de containers Docker ou instâncias compartilhadas de PostgreSQL/MySQL durante o desenvolvimento e testes automatizados.

## Conceito e Arquitetura

Ao trabalhar com múltiplos agentes em paralelo (ex.: `batista-loop`, `batista-execute`, `worker`), a concorrência em arquivos do repositório ou em um banco de dados compartilhado gera conflitos de migração, locks e poluição de estado de teste.

A abordagem do **batista-worktree** resolve isso com três pilares:

1. **Git Worktree por Feature/Task:** Cada subagente opera em seu próprio diretório de trabalho (`../worktrees/<feature-name>`), isolado do checkout principal.
2. **SQLite Isolado por Slot:** Cada worktree opera com seu próprio banco SQLite em `.tmp/dev.sqlite`, configurado via `.env.worktree` com URLs absolutas ou relativas (`DATABASE_URL="file:./.tmp/dev.sqlite"` ou `SQLITE_URL="sqlite:///./.tmp/dev.sqlite"`).
3. **Isolamento de Portas:** Cada worktree recebe um `WORKTREE_SLOT` (1, 2, 3...) com offset de portas (ex.: `PORT=3100`, `PORT=3200`), evitando conflitos de bind de portas entre múltiplos servidores de desenvolvimento ou suítes de teste.

```
Workspace Raiz (/repo)
 ├── .tmp/dev.sqlite (Slot 0 / Default: Port 3000)
 └── .features/

Worktree A (../worktrees/feat-auth)
 ├── .tmp/dev.sqlite (Slot 1: Port 3100)
 └── .env.worktree (DATABASE_URL="file:/abs/path/worktrees/feat-auth/.tmp/dev.sqlite")

Worktree B (../worktrees/feat-billing)
 ├── .tmp/dev.sqlite (Slot 2: Port 3200)
 └── .env.worktree (DATABASE_URL="file:/abs/path/worktrees/feat-billing/.tmp/dev.sqlite")
```

## CLI `wt.sh`

O script `skills/batista-worktree/scripts/wt.sh` automatiza todas as etapas de ciclo de vida de um worktree.

### 1. Inicializar ambiente no diretório atual
```bash
./skills/batista-worktree/scripts/wt.sh init [slot]
```
- Cria o diretório `.tmp/`.
- Gera `.env.worktree` com `WORKTREE_SLOT`, `PORT_OFFSET`, `PORT`, `DB_DRIVER=sqlite` e `DATABASE_URL`.

### 2. Criar novo Git Worktree isolado
```bash
./skills/batista-worktree/scripts/wt.sh create <branch> [dir]
```
- Cria o worktree via `git worktree add`.
- Detecta o próximo slot livre.
- Cria `.tmp/` e configura `.env.worktree` automaticamente no worktree de destino.

### 3. Verificar Status dos Worktrees
```bash
./skills/batista-worktree/scripts/wt.sh status
```
Lista todos os worktrees ativos, branch associada, slot alocado, porta e status do arquivo SQLite.

### 4. Resetar e Migrar Banco SQLite Local
```bash
# Resetar banco temporário do worktree atual
./skills/batista-worktree/scripts/wt.sh db reset

# Executar migrações do ORM configurado (Prisma, Drizzle, Knex, etc.)
./skills/batista-worktree/scripts/wt.sh db migrate
```

### 5. Remover Worktree
```bash
./skills/batista-worktree/scripts/wt.sh remove <dir>
```
Remove os arquivos temporários SQLite (`.tmp/*.sqlite*`) e executa `git worktree remove --force`.

## Configuração de Projetos e ORMs

Para que as aplicações dos subagentes consumam o banco SQLite local do worktree sem tocar em PostgreSQL ou Docker:

### Variáveis de Ambiente (`.env.worktree` / `.env`)
```bash
# Carregue no início dos scripts ou use dotenv
set -a
[ -f .env.worktree ] && source .env.worktree
set +a
```

### Prisma ORM
No `schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### Drizzle ORM
```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlitePath = process.env.DB_FILE || './.tmp/dev.sqlite';
const sqlite = new Database(sqlitePath);
export const db = drizzle(sqlite);
```

### TypeORM / Knex / Sequelize
Basta ler `process.env.DB_DRIVER` ou `process.env.DATABASE_URL` / `process.env.DB_FILE` e inicializar o cliente SQLite correspondente (`sqlite3` / `better-sqlite3`).

## Boas Práticas para Subagentes Paralelos

- **Nunca use Docker ou PostgreSQL compartilhado em testes de subagentes:** utilize sempre SQLite em arquivo local ou em memória (`:memory:`).
- **Sempre adicione `.tmp/` e `.env.worktree` ao `.gitignore`** para evitar commits acidentais de bases locais.
- **Ao finalizar a tarefa:** o agente orquestrador deve mesclar a branch e invocar `./scripts/wt.sh remove <dir>` para liberar o slot e podar o worktree.
