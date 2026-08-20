# Agent Draw format 0.1

The canonical artifact is JSON. Mermaid is planned as an import/export adapter because it cannot round-trip inspector state, capabilities, ports, provenance, multiple views, and plugin data reliably.

## Document invariants

- `format` is `agent-draw`; `version` is `0.1`.
- Every node and edge has a stable, document-unique ID.
- Semantic `type` values are plugin-qualified: `plugin.id/type`.
- Edges may only reference existing nodes and, when supplied, existing named ports.
- Port IDs are unique within a node. Connection direction is checked before a semantic edge is proposed.
- Plugin-specific opaque data belongs under a namespaced `extensions` key and must survive load/save.
- Credentials are forbidden. Store only host-resolved capability or secret references.
- `revision` changes on every accepted document mutation.

## Meaning versus layout

`label`, `type`, `data`, `ports`, and edges express meaning. `position`, `size`, view cameras, and future routing points express layout. Agents should avoid layout edits unless positioning is part of the task.

Database structure is represented as semantic nodes rather than tldraw shape
metadata. `agent-draw.core/database` exposes a `schema` output and
`agent-draw.core/table` stores columns in `data.columns`. Use
`agent-draw.core/contains` for database-to-table ownership and
`agent-draw.core/references` for table-to-table relationships. Stable table and
edge IDs must survive layout and schema edits.

## Patch operations

- `addNode` / `removeNode`
- `updateNode` — shallow-merges `data` and namespaced `extensions`
- `connect` / `disconnect`
- `setLayout`

Patches declare `documentId` and `baseRevision`. Applying a stale patch fails rather than silently overwriting concurrent human work. Removing a node removes its attached edges.

## Plugin manifest 0.1

A registered plugin declares `id`, `version`, compatible `hostApi`, node and edge types, and required capabilities. The current renderer and inspector hooks are build-time TypeScript. Future external plugins will add migrations, permissions, commands, and trusted loading without changing document type names.

Plugins may implement a `connect(source, sourcePortId, target, targetPortId)` rule. It returns an allowed plugin-qualified edge type and optional label, or a rejection reason. This rule is semantic and renderer-independent: React port dragging, the CLI, and MCP all call the same registry path.

The tldraw adapter may create shape IDs, arrow bindings, and transient preview arrows, but none of those records are serialized into this format.
