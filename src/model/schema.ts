import { z } from "zod";

export const pointSchema = z.object({ x: z.number(), y: z.number() });
export const sizeSchema = z.object({
  w: z.number().positive(),
  h: z.number().positive(),
});

export const portSchema = z.object({
  id: z.string().min(1),
  direction: z
    .enum(["input", "output", "bidirectional"])
    .default("bidirectional"),
  label: z.string().optional(),
  dataType: z.string().optional(),
});

export const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().regex(/^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9.-]*$/),
  label: z.string(),
  position: pointSchema,
  size: sizeSchema.default({ w: 240, h: 112 }),
  ports: z.array(portSchema).default([]),
  data: z.record(z.string(), z.unknown()).default({}),
  capabilityRefs: z.array(z.string()).default([]),
  extensions: z.record(z.string(), z.unknown()).default({}),
});

export const edgeEndpointSchema = z.object({
  nodeId: z.string().min(1),
  portId: z.string().optional(),
});

export const edgeSchema = z.object({
  id: z.string().min(1),
  type: z.string().regex(/^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9.-]*$/),
  label: z.string().optional(),
  source: edgeEndpointSchema,
  target: edgeEndpointSchema,
  data: z.record(z.string(), z.unknown()).default({}),
  extensions: z.record(z.string(), z.unknown()).default({}),
});

export const viewSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  nodeIds: z.array(z.string()).optional(),
  camera: z
    .object({ x: z.number(), y: z.number(), z: z.number().positive() })
    .optional(),
  extensions: z.record(z.string(), z.unknown()).default({}),
});

export const capabilitySchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const documentSchema = z
  .object({
    format: z.literal("agent-draw"),
    version: z.literal("0.1"),
    id: z.string().min(1),
    title: z.string(),
    revision: z.number().int().nonnegative(),
    plugins: z.record(z.string(), z.string()),
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
    views: z.array(viewSchema).default([]),
    capabilities: z.array(capabilitySchema).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
    extensions: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((document, context) => {
    const nodeIds = new Set<string>();
    const portsByNode = new Map<string, Set<string>>();
    for (const node of document.nodes) {
      if (nodeIds.has(node.id))
        context.addIssue({
          code: "custom",
          path: ["nodes"],
          message: `Duplicate node id: ${node.id}`,
        });
      nodeIds.add(node.id);
      const portIds = new Set<string>();
      for (const port of node.ports) {
        if (portIds.has(port.id))
          context.addIssue({
            code: "custom",
            path: ["nodes"],
            message: `${node.id} has duplicate port id: ${port.id}`,
          });
        portIds.add(port.id);
      }
      portsByNode.set(node.id, portIds);
    }
    const edgeIds = new Set<string>();
    for (const edge of document.edges) {
      if (edgeIds.has(edge.id))
        context.addIssue({
          code: "custom",
          path: ["edges"],
          message: `Duplicate edge id: ${edge.id}`,
        });
      edgeIds.add(edge.id);
      if (!nodeIds.has(edge.source.nodeId))
        context.addIssue({
          code: "custom",
          path: ["edges"],
          message: `${edge.id} has missing source ${edge.source.nodeId}`,
        });
      if (!nodeIds.has(edge.target.nodeId))
        context.addIssue({
          code: "custom",
          path: ["edges"],
          message: `${edge.id} has missing target ${edge.target.nodeId}`,
        });
      if (
        edge.source.portId &&
        !portsByNode.get(edge.source.nodeId)?.has(edge.source.portId)
      )
        context.addIssue({
          code: "custom",
          path: ["edges"],
          message: `${edge.id} has missing source port ${edge.source.nodeId}/${edge.source.portId}`,
        });
      if (
        edge.target.portId &&
        !portsByNode.get(edge.target.nodeId)?.has(edge.target.portId)
      )
        context.addIssue({
          code: "custom",
          path: ["edges"],
          message: `${edge.id} has missing target port ${edge.target.nodeId}/${edge.target.portId}`,
        });
    }
  });

export type AgentDrawNode = z.infer<typeof nodeSchema>;
export type AgentDrawEdge = z.infer<typeof edgeSchema>;
export type AgentDrawDocument = z.infer<typeof documentSchema>;

export function parseDocument(input: unknown): AgentDrawDocument {
  return documentSchema.parse(input);
}

export function formatDocument(document: AgentDrawDocument): string {
  return `${JSON.stringify(documentSchema.parse(document), null, 2)}\n`;
}
