# Agent instructions

`agent-draw` is an agent-first executable technical canvas. Read `README.md` and `docs/FORMAT.md` before changing the document model or plugin contracts.

## Non-negotiable boundaries

- `src/model` is canonical; tldraw is an adapter and must not leak record IDs or shape props into saved documents.
- Keep semantic edits separate from layout edits. Preserve stable node/edge IDs.
- Preserve unknown, namespaced `extensions` fields during every parse, patch, import, and export path.
- Documents may reference capabilities and secrets but must never contain credential values.
- Runtime actions require explicit host capabilities. Never execute code embedded in a diagram.
- Plugin types use `plugin.id/type`; manifests declare compatibility and capabilities.

## Before handing off

Run `pnpm test`, `pnpm typecheck`, and `pnpm build`. Visually verify UI changes. Update the Notion `agent-draw` project page when architecture, scope, or milestones change.

The private GitHub repository is `nicolaerusan/agent-draw`; the BB project ID is `proj_8jbfrsm4jv`.
