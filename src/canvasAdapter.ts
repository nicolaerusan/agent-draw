import {
  createBindingId,
  createShapeId,
  toRichText,
  type Editor,
  type TLShapeId,
} from "tldraw";
import {
  AGENT_DRAW_NODE_SHAPE,
  type AgentDrawNodeShape,
} from "./canvas/AgentDrawNodeShape";
import { canvasPort, portPagePoint } from "./canvas/ports";
import type { AgentDrawDocument } from "./model/schema";

export const nodeShapeId = (nodeId: string) =>
  createShapeId(`agent-draw-node-${nodeId}`);
export const edgeShapeId = (edgeId: string) =>
  createShapeId(`agent-draw-edge-${edgeId}`);

export interface CanvasNodeLayout {
  nodeId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function renderDocument(editor: Editor, document: AgentDrawDocument) {
  const existing = [...editor.getCurrentPageShapeIds()];
  if (existing.length) editor.deleteShapes(existing);

  editor.createShapes(
    document.nodes.map((node) => ({
      id: nodeShapeId(node.id),
      type: AGENT_DRAW_NODE_SHAPE,
      x: node.position.x,
      y: node.position.y,
      meta: { agentDrawNodeId: node.id, agentDrawType: node.type },
      props: { nodeId: node.id, w: node.size.w, h: node.size.h },
    })),
  );

  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  const arrowIds: TLShapeId[] = [];
  for (const edge of document.edges) {
    const source = nodes.get(edge.source.nodeId);
    const target = nodes.get(edge.target.nodeId);
    if (!source || !target) continue;
    const start = portPagePoint(source, edge.source.portId);
    const end = portPagePoint(target, edge.target.portId);
    const arrowId = edgeShapeId(edge.id);
    arrowIds.push(arrowId);
    editor.createShape({
      id: arrowId,
      type: "arrow",
      x: start.x,
      y: start.y,
      meta: { agentDrawEdgeId: edge.id, agentDrawType: edge.type },
      props: {
        start: { x: 0, y: 0 },
        end: { x: end.x - start.x, y: end.y - start.y },
        kind: "elbow",
        color: "grey",
        size: "s",
        dash: "solid",
        arrowheadEnd: "arrow",
        richText: toRichText(edge.label ?? ""),
      },
    });
    editor.createBindings([
      {
        id: createBindingId(),
        type: "arrow",
        fromId: arrowId,
        toId: nodeShapeId(source.id),
        props: {
          terminal: "start",
          normalizedAnchor: canvasPort(source, edge.source.portId)
            ?.normalizedAnchor ?? {
            x: 0.5,
            y: 0.5,
          },
          isExact: false,
          isPrecise: true,
        },
      },
      {
        id: createBindingId(),
        type: "arrow",
        fromId: arrowId,
        toId: nodeShapeId(target.id),
        props: {
          terminal: "end",
          normalizedAnchor: canvasPort(target, edge.target.portId)
            ?.normalizedAnchor ?? {
            x: 0.5,
            y: 0.5,
          },
          isExact: false,
          isPrecise: true,
        },
      },
    ]);
  }
  if (arrowIds.length) editor.sendToBack(arrowIds);
  editor.zoomToFit();
}

export function selectedNodeId(editor: Editor): string | null {
  const selected = editor
    .getSelectedShapes()
    .find((shape) => typeof shape.meta.agentDrawNodeId === "string");
  return selected ? String(selected.meta.agentDrawNodeId) : null;
}

export function canvasNodeLayouts(editor: Editor): CanvasNodeLayout[] {
  return editor
    .getCurrentPageShapes()
    .filter(
      (shape): shape is AgentDrawNodeShape =>
        shape.type === AGENT_DRAW_NODE_SHAPE &&
        typeof shape.meta.agentDrawNodeId === "string",
    )
    .map((shape) => ({
      nodeId: String(shape.meta.agentDrawNodeId),
      x: shape.x,
      y: shape.y,
      w: shape.props.w,
      h: shape.props.h,
    }));
}

export function selectNode(editor: Editor, nodeId: string) {
  editor.select(nodeShapeId(nodeId) as TLShapeId);
}
