---
name: batista-memory
description: Playbook for creating and updating technical memory of entities, components, contract files, and their relationships in `memory/<dominio>/`. Use as `/skill:batista-memory` when the agent creates, changes, removes, or documents an entity/model/API/UI/consumer/job/skill/domain file, or when a change affects a relationship between components and the domain `memory/` folder needs updating.
---

# Entity Memory Playbook

## Goal

Keep memory short, navigable, and traceable to current code so the next agent understands entities, components, and relationships without redoing the investigation.

## Workflow

1. **Locate repo memory.**
   - Use `memory/<dominio>/` if it exists or the repo already uses `memory/`.
   - `.memory/` is only for persistent repo-wide rules, not component maps.
   - Else create `memory/<dominio>/` with a short kebab-case name.

2. **Map source of truth before writing.**
   - Read models/types/schemas, services, controllers/routes, jobs/consumers, UI, docs.
   - Current code is primary; old memory and docs help but never override it.
   - Don't turn grep into documentation: group by domain responsibility.

3. **Define components by responsibility.**
   - One file per domain component: e.g. `MONITOR.md`, `ALERT.md`, `INCIDENT.md`.
   - `README.md` is the index, domain summary, and relationship diagram.
   - No file per button, card, or small helper; group visual details in `API_AND_UI.md` when sensible.

4. **Use a fixed structure in each file.**
   - `# Name`
   - `## Responsibility`
   - `## Entities`
   - `## Relations`
   - `## Flow`
   - `## Code sources`

5. **Update relationships with the change.**
   - Creating/changing/removing an entity, contract file, route, service, job, table/collection, domain UI component, or queue → update the matching memory file.
   - Change connecting two components → update both or the transversal file (`DATA_MODEL.md`, `API_AND_UI.md`, `QUEUES_AND_CONSUMERS.md`).
   - New component → add a file and link it in `README.md`.

6. **Keep it short and verifiable.**
   - Write in en-US; preserve code identifiers as-is.
   - Cite real paths in `Code sources`.
   - Remove placeholders, template typos, speculation.
   - Prefer simple Mermaid for core relationships.

## Minimal validation

Run focused checks before finishing:

```bash
rtk rg -n "TODO|FIXME|placeholder|path/to|single responsability|Componenets|\{uma" memory/<dominio>
rtk rg -n "[ \t]+$" memory/<dominio>
```

When citing many paths, verify they exist. Docs-only: skip the test suite; `rtk git diff --check` suffices if the repo allows it.

## Expected result

- `memory/<dominio>/README.md` explains the domain and lists components.
- Each relevant component has its own `.md`.
- Changed relationships are reflected in the README or a transversal file.
- Memory points to current code, not loose conversation conclusions.
