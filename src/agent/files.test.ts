import { describe, expect, it } from "vitest";
import { resolveAgentPath } from "./files";

describe("agent file boundary", () => {
  it("resolves paths inside the configured root", () => {
    expect(resolveAgentPath("/workspace", "docs/map.json")).toBe(
      "/workspace/docs/map.json",
    );
  });

  it("rejects paths outside the configured root", () => {
    expect(() => resolveAgentPath("/workspace", "../secret.txt")).toThrow(
      /configured root/,
    );
  });
});
