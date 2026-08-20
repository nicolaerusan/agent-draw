import { graphPatchSchema, type GraphPatch } from "./patch";
import {
  documentSchema,
  type AgentDrawDocument,
  type AgentDrawEdge,
  type AgentDrawNode,
} from "./schema";

const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

function edgeChanged(before: AgentDrawEdge, after: AgentDrawEdge) {
  return !same({ ...before, id: undefined }, { ...after, id: undefined });
}

function nodeChanges(before: AgentDrawNode, after: AgentDrawNode) {
  const changes: Extract<
    GraphPatch["operations"][number],
    { op: "updateNode" }
  >["changes"] = {};
  if (before.label !== after.label) changes.label = after.label;
  if (!same(before.size, after.size)) changes.size = after.size;
  if (!same(before.ports, after.ports)) changes.ports = after.ports;
  if (!same(before.data, after.data)) {
    changes.data = after.data;
    changes.replaceData = true;
  }
  if (!same(before.capabilityRefs, after.capabilityRefs))
    changes.capabilityRefs = after.capabilityRefs;
  if (!same(before.extensions, after.extensions)) {
    changes.extensions = after.extensions;
    changes.replaceExtensions = true;
  }
  return changes;
}

export function diffDocuments(
  beforeInput: AgentDrawDocument,
  afterInput: AgentDrawDocument,
): GraphPatch {
  const before = documentSchema.parse(beforeInput);
  const after = documentSchema.parse(afterInput);
  if (before.id !== after.id)
    throw new Error(
      `Cannot diff different documents: ${before.id} and ${after.id}`,
    );

  const operations: GraphPatch["operations"] = [];
  const documentChanges: Extract<
    GraphPatch["operations"][number],
    { op: "updateDocument" }
  >["changes"] = {};
  for (const key of [
    "title",
    "plugins",
    "views",
    "capabilities",
    "metadata",
    "extensions",
  ] as const) {
    if (!same(before[key], after[key]))
      Object.assign(documentChanges, { [key]: after[key] });
  }
  if (Object.keys(documentChanges).length)
    operations.push({ op: "updateDocument", changes: documentChanges });

  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));
  const beforeEdges = new Map(before.edges.map((edge) => [edge.id, edge]));
  const afterEdges = new Map(after.edges.map((edge) => [edge.id, edge]));

  for (const edge of before.edges) {
    const replacement = afterEdges.get(edge.id);
    if (!replacement || edgeChanged(edge, replacement))
      operations.push({ op: "disconnect", edgeId: edge.id });
  }

  for (const node of before.nodes) {
    const replacement = afterNodes.get(node.id);
    if (!replacement || replacement.type !== node.type)
      operations.push({ op: "removeNode", nodeId: node.id });
  }

  for (const [nodeIndex, node] of after.nodes.entries()) {
    const previous = beforeNodes.get(node.id);
    if (!previous || previous.type !== node.type) {
      operations.push({ op: "addNode", node, index: nodeIndex });
      continue;
    }
    const changes = nodeChanges(previous, node);
    if (Object.keys(changes).length)
      operations.push({ op: "updateNode", nodeId: node.id, changes });
    if (!same(previous.position, node.position))
      operations.push({
        op: "setLayout",
        nodeId: node.id,
        position: node.position,
      });
  }

  for (const [edgeIndex, edge] of after.edges.entries()) {
    const previous = beforeEdges.get(edge.id);
    if (!previous || edgeChanged(previous, edge))
      operations.push({ op: "connect", edge, index: edgeIndex });
  }

  return graphPatchSchema.parse({
    format: "agent-draw-patch",
    version: "0.1",
    documentId: before.id,
    baseRevision: before.revision,
    operations,
  });
}
