import { z } from "zod";
import {
  capabilitySchema,
  documentSchema,
  edgeSchema,
  nodeSchema,
  pointSchema,
  portSchema,
  sizeSchema,
  viewSchema,
  type AgentDrawDocument,
} from "./schema";

const patchOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("updateDocument"),
    changes: z.object({
      title: z.string().optional(),
      plugins: z.record(z.string(), z.string()).optional(),
      views: z.array(viewSchema).optional(),
      capabilities: z.array(capabilitySchema).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      extensions: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  z.object({
    op: z.literal("addNode"),
    node: nodeSchema,
    index: z.number().int().nonnegative().optional(),
  }),
  z.object({
    op: z.literal("updateNode"),
    nodeId: z.string(),
    changes: z.object({
      label: z.string().optional(),
      size: sizeSchema.optional(),
      ports: z.array(portSchema).optional(),
      data: z.record(z.string(), z.unknown()).optional(),
      replaceData: z.boolean().optional(),
      capabilityRefs: z.array(z.string()).optional(),
      extensions: z.record(z.string(), z.unknown()).optional(),
      replaceExtensions: z.boolean().optional(),
    }),
  }),
  z.object({ op: z.literal("removeNode"), nodeId: z.string() }),
  z.object({
    op: z.literal("connect"),
    edge: edgeSchema,
    index: z.number().int().nonnegative().optional(),
  }),
  z.object({ op: z.literal("disconnect"), edgeId: z.string() }),
  z.object({
    op: z.literal("setLayout"),
    nodeId: z.string(),
    position: pointSchema,
  }),
]);

export const graphPatchSchema = z.object({
  format: z.literal("agent-draw-patch"),
  version: z.literal("0.1"),
  documentId: z.string(),
  baseRevision: z.number().int().nonnegative(),
  operations: z.array(patchOperationSchema),
});

export type GraphPatch = z.infer<typeof graphPatchSchema>;

export function applyPatch(
  documentInput: AgentDrawDocument,
  patchInput: GraphPatch,
): AgentDrawDocument {
  const document = documentSchema.parse(structuredClone(documentInput));
  const patch = graphPatchSchema.parse(patchInput);
  if (document.id !== patch.documentId)
    throw new Error(`Patch targets ${patch.documentId}, not ${document.id}`);
  if (document.revision !== patch.baseRevision)
    throw new Error(
      `Revision conflict: expected ${document.revision}, received ${patch.baseRevision}`,
    );

  for (const operation of patch.operations) {
    switch (operation.op) {
      case "updateDocument":
        Object.assign(document, operation.changes);
        break;
      case "addNode":
        if (document.nodes.some((node) => node.id === operation.node.id))
          throw new Error(`Node exists: ${operation.node.id}`);
        if (operation.index === undefined) document.nodes.push(operation.node);
        else
          document.nodes.splice(
            Math.min(operation.index, document.nodes.length),
            0,
            operation.node,
          );
        break;
      case "updateNode": {
        const node = document.nodes.find(
          (candidate) => candidate.id === operation.nodeId,
        );
        if (!node) throw new Error(`Unknown node: ${operation.nodeId}`);
        if (operation.changes.label !== undefined)
          node.label = operation.changes.label;
        if (operation.changes.size) node.size = operation.changes.size;
        if (operation.changes.ports) node.ports = operation.changes.ports;
        if (operation.changes.data)
          node.data = operation.changes.replaceData
            ? operation.changes.data
            : { ...node.data, ...operation.changes.data };
        if (operation.changes.capabilityRefs)
          node.capabilityRefs = operation.changes.capabilityRefs;
        if (operation.changes.extensions)
          node.extensions = operation.changes.replaceExtensions
            ? operation.changes.extensions
            : { ...node.extensions, ...operation.changes.extensions };
        break;
      }
      case "removeNode":
        if (!document.nodes.some((node) => node.id === operation.nodeId))
          throw new Error(`Unknown node: ${operation.nodeId}`);
        document.nodes = document.nodes.filter(
          (node) => node.id !== operation.nodeId,
        );
        document.edges = document.edges.filter(
          (edge) =>
            edge.source.nodeId !== operation.nodeId &&
            edge.target.nodeId !== operation.nodeId,
        );
        break;
      case "connect":
        if (document.edges.some((edge) => edge.id === operation.edge.id))
          throw new Error(`Edge exists: ${operation.edge.id}`);
        if (operation.index === undefined) document.edges.push(operation.edge);
        else
          document.edges.splice(
            Math.min(operation.index, document.edges.length),
            0,
            operation.edge,
          );
        break;
      case "disconnect":
        if (!document.edges.some((edge) => edge.id === operation.edgeId))
          throw new Error(`Unknown edge: ${operation.edgeId}`);
        document.edges = document.edges.filter(
          (edge) => edge.id !== operation.edgeId,
        );
        break;
      case "setLayout": {
        const node = document.nodes.find(
          (candidate) => candidate.id === operation.nodeId,
        );
        if (!node) throw new Error(`Unknown node: ${operation.nodeId}`);
        node.position = operation.position;
        break;
      }
    }
  }
  document.revision += 1;
  return documentSchema.parse(document);
}
