import { describe, expect, it } from "vitest";
import { seedDocument } from "../data";
import { formatDocument, parseDocument } from "./schema";

describe("agent-draw document schema", () => {
  it("round-trips the canonical document without losing namespaced extension data", () => {
    const input = structuredClone(seedDocument);
    input.extensions["example.future-plugin"] = { opaque: ["data", 42] };
    const parsed = parseDocument(JSON.parse(formatDocument(input)));
    expect(parsed.extensions["example.future-plugin"]).toEqual({
      opaque: ["data", 42],
    });
    expect(parsed.nodes).toHaveLength(8);
  });

  it("rejects dangling graph edges", () => {
    const invalid = structuredClone(seedDocument);
    invalid.edges[0].target.nodeId = "missing-node";
    expect(() => parseDocument(invalid)).toThrow(/missing target/);
  });

  it("rejects edges that name missing ports", () => {
    const invalid = structuredClone(seedDocument);
    invalid.edges[0].target.portId = "missing-port";
    expect(() => parseDocument(invalid)).toThrow(/missing target port/);
  });

  it("rejects duplicate port ids within one node", () => {
    const invalid = structuredClone(seedDocument);
    invalid.nodes[0].ports.push(structuredClone(invalid.nodes[0].ports[0]));
    expect(() => parseDocument(invalid)).toThrow(/duplicate port id/);
  });

  it("rejects non-namespaced semantic types", () => {
    const invalid = structuredClone(seedDocument);
    invalid.nodes[0].type = "endpoint";
    expect(() => parseDocument(invalid)).toThrow();
  });
});
