import type { AgentDrawNode } from "../model/schema";

export interface CanvasPort {
  nodeId: string;
  portId: string;
  label: string;
  direction: "input" | "output" | "bidirectional";
  side: "left" | "right";
  x: number;
  y: number;
  normalizedAnchor: { x: number; y: number };
}

function sideFor(direction: CanvasPort["direction"]) {
  return direction === "input" ? "left" : "right";
}

export function canvasPorts(node: AgentDrawNode): CanvasPort[] {
  const sides = {
    left: node.ports.filter((port) => sideFor(port.direction) === "left"),
    right: node.ports.filter((port) => sideFor(port.direction) === "right"),
  };

  return node.ports.map((port) => {
    const side = sideFor(port.direction);
    const siblings = sides[side];
    const index = siblings.findIndex((candidate) => candidate.id === port.id);
    const normalizedY = (index + 1) / (siblings.length + 1);
    return {
      nodeId: node.id,
      portId: port.id,
      label: port.label ?? port.id,
      direction: port.direction,
      side,
      x: side === "left" ? 0 : node.size.w,
      y: node.size.h * normalizedY,
      normalizedAnchor: { x: side === "left" ? 0 : 1, y: normalizedY },
    };
  });
}

export function canvasPort(node: AgentDrawNode, portId?: string) {
  const ports = canvasPorts(node);
  if (portId) return ports.find((port) => port.portId === portId);
  return ports.find((port) => port.direction !== "input") ?? ports[0];
}

export function portPagePoint(node: AgentDrawNode, portId?: string) {
  const port = canvasPort(node, portId);
  if (!port) {
    return {
      x: node.position.x + node.size.w / 2,
      y: node.position.y + node.size.h / 2,
    };
  }
  return { x: node.position.x + port.x, y: node.position.y + port.y };
}
