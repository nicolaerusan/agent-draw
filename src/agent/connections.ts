import type { GraphPatch } from "../model/patch";
import type {
  AgentDrawDocument,
  AgentDrawEdge,
  AgentDrawNode,
} from "../model/schema";
import { pluginRegistry } from "../plugins/registry";
import type { PluginRegistry } from "../plugins/types";

export interface SemanticPortReference {
  nodeId: string;
  portId: string;
}

function nodeAndPort(
  document: AgentDrawDocument,
  reference: SemanticPortReference,
) {
  const node = document.nodes.find(
    (candidate) => candidate.id === reference.nodeId,
  );
  if (!node) throw new Error(`Unknown node: ${reference.nodeId}`);
  const port = node.ports.find(
    (candidate) => candidate.id === reference.portId,
  );
  if (!port)
    throw new Error(`Unknown port: ${reference.nodeId}/${reference.portId}`);
  return { node, port };
}

export function proposeConnection(
  document: AgentDrawDocument,
  sourceReference: SemanticPortReference,
  targetReference: SemanticPortReference,
  registry: PluginRegistry = pluginRegistry,
): GraphPatch {
  if (sourceReference.nodeId === targetReference.nodeId)
    throw new Error("A node cannot connect to itself");

  const source = nodeAndPort(document, sourceReference);
  const target = nodeAndPort(document, targetReference);
  if (source.port.direction === "input")
    throw new Error(
      `${source.node.id}/${source.port.id} is not an output port`,
    );
  if (target.port.direction === "output")
    throw new Error(`${target.node.id}/${target.port.id} is not an input port`);
  if (
    document.edges.some(
      (edge) =>
        edge.source.nodeId === source.node.id &&
        edge.source.portId === source.port.id &&
        edge.target.nodeId === target.node.id &&
        edge.target.portId === target.port.id,
    )
  ) {
    throw new Error("That connection already exists");
  }

  const decision = registry.connectionDecision(
    source.node,
    source.port.id,
    target.node,
    target.port.id,
  );
  if (!decision.allowed)
    throw new Error(decision.reason ?? "Connection is not allowed");

  const edge: AgentDrawEdge = {
    id: uniqueEdgeId(document, source.node, target.node),
    type: decision.edgeType,
    label: decision.label,
    source: { nodeId: source.node.id, portId: source.port.id },
    target: { nodeId: target.node.id, portId: target.port.id },
    data: {},
    extensions: {},
  };

  return {
    format: "agent-draw-patch",
    version: "0.1",
    documentId: document.id,
    baseRevision: document.revision,
    operations: [{ op: "connect", edge }],
  };
}

function uniqueEdgeId(
  document: AgentDrawDocument,
  source: AgentDrawNode,
  target: AgentDrawNode,
) {
  const base = `edge-${source.id}-${target.id}`.slice(0, 112);
  let candidate = base;
  let suffix = 2;
  while (document.edges.some((edge) => edge.id === candidate))
    candidate = `${base}-${suffix++}`;
  return candidate;
}
