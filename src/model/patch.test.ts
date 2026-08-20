import { describe, expect, it } from "vitest";
import { seedDocument } from "../data";
import { applyPatch, type GraphPatch } from "./patch";

describe("graph patches", () => {
  it("lets an agent add and connect a semantic node without touching layout elsewhere", () => {
    const patch: GraphPatch = {
      format: "agent-draw-patch",
      version: "0.1",
      documentId: seedDocument.id,
      baseRevision: 0,
      operations: [
        {
          op: "addNode",
          node: {
            id: "endpoint-create-project",
            type: "agent-draw.api/endpoint",
            label: "Create project",
            position: { x: 80, y: 560 },
            size: { w: 260, h: 116 },
            ports: [],
            data: {
              method: "POST",
              url: "https://httpbin.org/anything/projects",
            },
            capabilityRefs: ["http-runtime"],
            extensions: {},
          },
        },
        {
          op: "connect",
          edge: {
            id: "edge-create-service",
            type: "agent-draw.api/invokes",
            source: { nodeId: "endpoint-create-project" },
            target: { nodeId: "service-api" },
            data: {},
            extensions: {},
          },
        },
      ],
    };
    const next = applyPatch(seedDocument, patch);
    expect(next.revision).toBe(1);
    expect(
      next.nodes.find((node) => node.id === "service-api")?.position,
    ).toEqual({ x: 445, y: 110 });
    expect(
      next.nodes.some((node) => node.id === "endpoint-create-project"),
    ).toBe(true);
    expect(next.edges.some((edge) => edge.id === "edge-create-service")).toBe(
      true,
    );
  });

  it("prevents agents from overwriting a newer revision", () => {
    expect(() =>
      applyPatch(
        { ...seedDocument, revision: 4 },
        {
          format: "agent-draw-patch",
          version: "0.1",
          documentId: seedDocument.id,
          baseRevision: 3,
          operations: [],
        },
      ),
    ).toThrow(/Revision conflict/);
  });

  it("removes attached edges when a node is removed", () => {
    const next = applyPatch(seedDocument, {
      format: "agent-draw-patch",
      version: "0.1",
      documentId: seedDocument.id,
      baseRevision: 0,
      operations: [{ op: "removeNode", nodeId: "service-api" }],
    });
    expect(
      next.edges.some(
        (edge) =>
          edge.source.nodeId === "service-api" ||
          edge.target.nodeId === "service-api",
      ),
    ).toBe(false);
  });
});
