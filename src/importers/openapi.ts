import { z } from "zod";
import type { AgentDrawDocument, AgentDrawNode } from "../model/schema";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

const openApiSchema = z.object({
  openapi: z.string().regex(/^3\./, "Only OpenAPI 3.x documents are supported"),
  info: z.object({ title: z.string(), version: z.string() }),
  servers: z
    .array(
      z.object({
        url: z.string(),
        variables: z
          .record(
            z.string(),
            z.object({ default: z.union([z.string(), z.number()]) }),
          )
          .optional(),
      }),
    )
    .optional(),
  paths: z.record(z.string(), z.record(z.string(), z.unknown())),
});

const operationSchema = z.object({
  operationId: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  requestBody: z
    .object({
      content: z.record(
        z.string(),
        z.object({
          example: z.unknown().optional(),
          schema: z
            .object({ example: z.unknown().optional() })
            .passthrough()
            .optional(),
        }),
      ),
    })
    .optional(),
  responses: z.record(z.string(), z.unknown()).optional(),
});

export interface OpenApiImportOptions {
  source?: string;
  serverUrl?: string;
}

interface ImportedOperation {
  method: Uppercase<(typeof HTTP_METHODS)[number]>;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tag: string;
  body?: string;
}

function slug(value: string) {
  const result = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return result || "item";
}

type OpenApiServer = NonNullable<
  z.infer<typeof openApiSchema>["servers"]
>[number];

function resolveServer(server?: OpenApiServer) {
  if (!server) return "";
  return server.url.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = server.variables?.[name]?.default;
    return value === undefined ? `{${name}}` : String(value);
  });
}

function requestExample(operation: z.infer<typeof operationSchema>) {
  const json = operation.requestBody?.content["application/json"];
  const example = json?.example ?? json?.schema?.example;
  if (example === undefined) return undefined;
  return typeof example === "string"
    ? example
    : JSON.stringify(example, null, 2);
}

function joinUrl(base: string, path: string) {
  if (!base) return path;
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function uniqueId(preferred: string, used: Set<string>) {
  let candidate = preferred;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${preferred}-${suffix++}`;
  used.add(candidate);
  return candidate;
}

export function importOpenApi(
  input: unknown,
  options: OpenApiImportOptions = {},
): AgentDrawDocument {
  const spec = openApiSchema.parse(input);
  const operations: ImportedOperation[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const candidate = pathItem[method];
      if (!candidate) continue;
      const parsed = operationSchema.safeParse(candidate);
      if (!parsed.success) continue;
      operations.push({
        method: method.toUpperCase() as ImportedOperation["method"],
        path,
        operationId: parsed.data.operationId,
        summary: parsed.data.summary,
        description: parsed.data.description,
        tag: parsed.data.tags?.[0] ?? spec.info.title,
        body: requestExample(parsed.data),
      });
    }
  }

  if (!operations.length)
    throw new Error("The OpenAPI document has no importable HTTP operations");

  const serverUrl = options.serverUrl ?? resolveServer(spec.servers?.[0]);
  const groups = new Map<string, ImportedOperation[]>();
  for (const operation of operations) {
    const group = groups.get(operation.tag) ?? [];
    group.push(operation);
    groups.set(operation.tag, group);
  }

  const usedIds = new Set<string>();
  const nodes: AgentDrawNode[] = [];
  const edges: AgentDrawDocument["edges"] = [];

  [...groups.entries()].forEach(([tag, group], groupIndex) => {
    const groupOffset = groupIndex * 720;
    const serviceId = uniqueId(`service-${slug(tag)}`, usedIds);
    nodes.push({
      id: serviceId,
      type: "agent-draw.core/service",
      label: tag,
      position: {
        x: 480 + groupOffset,
        y: 90 + Math.max(0, group.length - 1) * 64,
      },
      size: { w: 250, h: 116 },
      ports: [
        { id: "request", direction: "input", label: "request" },
        { id: "calls", direction: "output", label: "calls" },
      ],
      data: {
        openapiTitle: spec.info.title,
        openapiVersion: spec.info.version,
        operationCount: group.length,
      },
      capabilityRefs: [],
      extensions: {
        "agent-draw.provenance": {
          source: options.source ?? "OpenAPI document",
          tag,
        },
      },
    });

    group.forEach((operation, operationIndex) => {
      const operationKey =
        operation.operationId || `${operation.method}-${operation.path}`;
      const endpointId = uniqueId(`endpoint-${slug(operationKey)}`, usedIds);
      nodes.push({
        id: endpointId,
        type: "agent-draw.api/endpoint",
        label:
          operation.summary ||
          operation.operationId ||
          `${operation.method} ${operation.path}`,
        position: { x: 80 + groupOffset, y: 50 + operationIndex * 150 },
        size: { w: 300, h: 116 },
        ports: [
          { id: "request", direction: "input", label: "request" },
          { id: "invokes", direction: "output", label: "invokes" },
        ],
        data: {
          method: operation.method,
          url: joinUrl(serverUrl, operation.path),
          headers: { accept: "application/json" },
          ...(operation.body ? { body: operation.body } : {}),
          ...(operation.description
            ? { description: operation.description }
            : {}),
          path: operation.path,
          ...(operation.operationId
            ? { operationId: operation.operationId }
            : {}),
          tag: operation.tag,
        },
        capabilityRefs: ["http-runtime"],
        extensions: {
          "agent-draw.provenance": {
            source: options.source ?? "OpenAPI document",
            openapiVersion: spec.openapi,
            method: operation.method,
            path: operation.path,
          },
        },
      });
      edges.push({
        id: uniqueId(`edge-${endpointId}-${serviceId}`, usedIds),
        type: "agent-draw.api/invokes",
        label: "invokes",
        source: { nodeId: endpointId, portId: "invokes" },
        target: { nodeId: serviceId, portId: "request" },
        data: {},
        extensions: {},
      });
    });
  });

  return {
    format: "agent-draw",
    version: "0.1",
    id: `openapi-${slug(spec.info.title)}`,
    title: `${spec.info.title} · API map`,
    revision: 0,
    plugins: { "agent-draw.core": "^0.1.0", "agent-draw.api": "^0.1.0" },
    nodes,
    edges,
    views: [{ id: "api-map", name: "API map", extensions: {} }],
    capabilities: [
      {
        id: "http-runtime",
        kind: "network.http",
        config: { policy: "public-network-only" },
      },
    ],
    metadata: {
      importedFrom: "openapi",
      source: options.source ?? "OpenAPI document",
      openapiVersion: spec.openapi,
      apiVersion: spec.info.version,
    },
    extensions: {},
  };
}
