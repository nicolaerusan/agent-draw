# Agent tools

Agent Draw exposes one semantic graph implementation through three callers: the React canvas, the `agent-draw` CLI, and an MCP stdio server. None of them write tldraw records into saved documents.

## Recommended agent loop

1. Call `read_document` and retain its `revision`.
2. Inspect node types and named ports. Use `list_plugins` when choosing a node or edge type.
3. Call `propose_connection` or construct a small `agent-draw-patch/0.1` proposal.
4. Present the semantic change separately from optional layout changes.
5. Call `apply_patch`. If its optimistic revision check fails, reread and regenerate the patch.

## MCP tools

| Tool                 | Effect        | Notes                                                                                 |
| -------------------- | ------------- | ------------------------------------------------------------------------------------- |
| `read_document`      | Read-only     | Parses and validates canonical JSON/YAML.                                             |
| `list_plugins`       | Read-only     | Returns manifests, node/edge types, and host capabilities.                            |
| `propose_connection` | Read-only     | Checks node/port existence, direction, duplicates, and plugin rules; returns a patch. |
| `apply_patch`        | Writes        | Overwrites one document only after document ID and revision checks pass.              |
| `import_openapi`     | Read or write | Returns an imported graph; writes only when `outputPath` is explicit.                 |

All paths are resolved beneath `AGENT_DRAW_ROOT`. Traversal outside that root is rejected. Documents may contain capability references, but never credential values. MCP tools describe or patch graphs; they do not execute code embedded in a diagram.

## Why MCP rather than an MCP-shaped document model

MCP is the transport and discovery layer for agents. The Agent Draw JSON and patch formats remain the durable interchange layer. That keeps files usable from Git, CI, the browser, and other agent protocols while MCP provides structured discovery and bounded host operations.

The connection path illustrates the boundary:

```text
React port drag ─┐
CLI connect ─────┼─> proposeConnection() ─> agent-draw patch ─> canonical document
MCP tool ────────┘
```

The tldraw store is never exposed as an agent contract. This keeps scene details replaceable and prevents agents from depending on renderer-specific shape or binding IDs.
