import { describe, expect, it } from "vitest";
import { buildHttpExecutionRequest } from "./http";

describe("HTTP capability request construction", () => {
  it("adds JSON content type for JSON request bodies", () => {
    expect(
      buildHttpExecutionRequest({
        method: "POST",
        url: " https://example.com/projects ",
        headers: {},
        body: '{"name":"demo"}',
      }),
    ).toEqual({
      method: "POST",
      url: "https://example.com/projects",
      headers: { "content-type": "application/json" },
      body: '{"name":"demo"}',
    });
  });

  it("never sends a body for GET", () => {
    expect(
      buildHttpExecutionRequest({
        method: "GET",
        url: "https://example.com",
        headers: {},
        body: "ignored",
      }),
    ).not.toHaveProperty("body");
  });
});
