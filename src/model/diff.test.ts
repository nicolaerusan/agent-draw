import { describe, expect, it } from "vitest";
import { seedDocument } from "../data";
import { applyPatch } from "./patch";
import { diffDocuments } from "./diff";

describe("document diffs", () => {
  it("produces a patch that exactly reconstructs semantic, layout, and document changes", () => {
    const after = structuredClone(seedDocument);
    after.revision = 1;
    after.title = "Updated system map";
    after.metadata = { owner: "platform" };
    const service = after.nodes.find((node) => node.id === "service-api")!;
    service.label = "Projects service";
    service.position = { x: 520, y: 180 };
    service.data = { runtime: "Bun" };
    after.edges = after.edges
      .filter((edge) => edge.id !== "edge-file-service")
      .map((edge) =>
        edge.id === "edge-service-db" ? { ...edge, label: "queries" } : edge,
      );
    after.nodes = after.nodes.filter((node) => node.id !== "file-router");
    after.nodes.push({
      id: "service-worker",
      type: "agent-draw.core/service",
      label: "Background worker",
      position: { x: 520, y: 520 },
      size: { w: 240, h: 112 },
      ports: [],
      data: {},
      capabilityRefs: [],
      extensions: {},
    });

    const patch = diffDocuments(seedDocument, after);
    const reconstructed = applyPatch(seedDocument, patch);
    expect(reconstructed).toEqual(after);
    expect(
      patch.operations.some((operation) => operation.op === "updateDocument"),
    ).toBe(true);
    expect(
      patch.operations.some((operation) => operation.op === "setLayout"),
    ).toBe(true);
  });

  it("rejects diffs across document identities", () => {
    expect(() =>
      diffDocuments(seedDocument, { ...seedDocument, id: "other" }),
    ).toThrow(/different documents/);
  });
});
