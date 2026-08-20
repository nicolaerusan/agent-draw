#!/usr/bin/env -S node --import tsx

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { proposeConnection } from "../src/agent/connections";
import {
  readDocumentFile,
  readStructuredFile,
  writeDocumentFile,
} from "../src/agent/files";
import { importOpenApi } from "../src/importers/openapi";
import { applyPatch, graphPatchSchema } from "../src/model/patch";
import { pluginRegistry } from "../src/plugins/registry";

const root = process.env.AGENT_DRAW_ROOT ?? process.cwd();

function result(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

export function createAgentDrawMcpServer() {
  const server = new McpServer(
    { name: "agent-draw", version: "0.1.0" },
    {
      instructions:
        "Read and patch canonical agent-draw documents. Preserve stable IDs and extensions. Propose semantic changes separately from layout. Never place credentials or executable code in a document.",
    },
  );

  server.registerTool(
    "read_document",
    {
      title: "Read agent-draw document",
      description:
        "Parse and return one canonical graph document inside the configured root.",
      inputSchema: z.object({ path: z.string().min(1) }),
      annotations: { readOnlyHint: true },
    },
    async ({ path }) =>
      result({ document: await readDocumentFile(root, path) }),
  );

  server.registerTool(
    "list_plugins",
    {
      title: "List drawing plugins",
      description:
        "List registered semantic node and edge types plus required host capabilities.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () =>
      result({
        plugins: pluginRegistry.list().map((plugin) => plugin.manifest),
      }),
  );

  server.registerTool(
    "propose_connection",
    {
      title: "Propose typed port connection",
      description:
        "Validate two named ports with plugin rules and return an optimistic agent-draw patch without changing the file.",
      inputSchema: z.object({
        path: z.string().min(1),
        sourceNodeId: z.string().min(1),
        sourcePortId: z.string().min(1),
        targetNodeId: z.string().min(1),
        targetPortId: z.string().min(1),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({
      path,
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId,
    }) => {
      const document = await readDocumentFile(root, path);
      return result({
        patch: proposeConnection(
          document,
          { nodeId: sourceNodeId, portId: sourcePortId },
          { nodeId: targetNodeId, portId: targetPortId },
        ),
      });
    },
  );

  server.registerTool(
    "apply_patch",
    {
      title: "Apply graph patch",
      description:
        "Validate and apply an optimistic patch, then overwrite the same document only when its base revision matches.",
      inputSchema: z.object({
        path: z.string().min(1),
        patch: z.unknown(),
      }),
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    async ({ path, patch: patchInput }) => {
      const document = await readDocumentFile(root, path);
      const patch = graphPatchSchema.parse(patchInput);
      const next = applyPatch(document, patch);
      await writeDocumentFile(root, path, next);
      return result({
        applied: true,
        path,
        revision: next.revision,
        nodes: next.nodes.length,
        edges: next.edges.length,
      });
    },
  );

  server.registerTool(
    "import_openapi",
    {
      title: "Import OpenAPI graph",
      description:
        "Convert an OpenAPI YAML or JSON file into canonical agent-draw data. Writes only when outputPath is supplied.",
      inputSchema: z.object({
        path: z.string().min(1),
        serverUrl: z.string().url().optional(),
        outputPath: z.string().min(1).optional(),
      }),
    },
    async ({ path, serverUrl, outputPath }) => {
      const document = importOpenApi(await readStructuredFile(root, path), {
        source: path,
        ...(serverUrl ? { serverUrl } : {}),
      });
      if (outputPath) await writeDocumentFile(root, outputPath, document);
      return result({ document, ...(outputPath ? { outputPath } : {}) });
    },
  );

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  serveStdio(createAgentDrawMcpServer, {
    onerror: (error) =>
      process.stderr.write(`agent-draw MCP: ${error.message}\n`),
  });
}
