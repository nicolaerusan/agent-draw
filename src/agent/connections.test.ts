import { describe, expect, it } from "vitest";
import { seedDocument } from "../data";
import { applyPatch } from "../model/patch";
import { proposeConnection } from "./connections";

describe("semantic connections", () => {
  it("uses plugin rules to produce a revision-safe canonical connection", () => {
    const document = structuredClone(seedDocument);
    document.edges = document.edges.filter(
      (edge) => edge.id !== "edge-service-github",
    );
    const patch = proposeConnection(
      document,
      { nodeId: "service-api", portId: "calls" },
      { nodeId: "external-github", portId: "request" },
    );
    const edge = patch.operations[0];
    expect(edge).toMatchObject({
      op: "connect",
      edge: {
        type: "agent-draw.core/calls",
        label: "calls",
        source: { nodeId: "service-api", portId: "calls" },
        target: { nodeId: "external-github", portId: "request" },
      },
    });
    expect(applyPatch(document, patch).revision).toBe(document.revision + 1);
  });

  it("rejects missing, reversed, duplicate, and self connections", () => {
    expect(() =>
      proposeConnection(
        seedDocument,
        { nodeId: "database-projects", portId: "query" },
        { nodeId: "service-api", portId: "request" },
      ),
    ).toThrow(/not an output/);
    expect(() =>
      proposeConnection(
        seedDocument,
        { nodeId: "endpoint-list-projects", portId: "invokes" },
        { nodeId: "endpoint-list-projects", portId: "request" },
      ),
    ).toThrow(/itself/);
    expect(() =>
      proposeConnection(
        seedDocument,
        { nodeId: "endpoint-list-projects", portId: "invokes" },
        { nodeId: "service-api", portId: "request" },
      ),
    ).toThrow(/already exists/);
  });

  it("models database containment and foreign-key references explicitly", () => {
    const document = structuredClone(seedDocument);
    document.edges = document.edges.filter(
      (edge) =>
        edge.id !== "edge-db-projects" && edge.id !== "edge-sources-projects",
    );

    expect(
      proposeConnection(
        document,
        { nodeId: "database-projects", portId: "schema" },
        { nodeId: "table-projects", portId: "database" },
      ).operations[0],
    ).toMatchObject({
      edge: { type: "agent-draw.core/contains", label: "contains" },
    });

    expect(
      proposeConnection(
        document,
        { nodeId: "table-sources", portId: "references" },
        { nodeId: "table-projects", portId: "reference" },
      ).operations[0],
    ).toMatchObject({
      edge: { type: "agent-draw.core/references", label: "references" },
    });

    expect(() =>
      proposeConnection(
        document,
        { nodeId: "service-api", portId: "calls" },
        { nodeId: "table-projects", portId: "database" },
      ),
    ).toThrow(/query port/);
  });
});
