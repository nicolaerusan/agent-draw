import { describe, expect, it } from "vitest";
import { importOpenApi } from "./openapi";

const fixture = {
  openapi: "3.1.0",
  info: { title: "Project Service", version: "1.4.0" },
  servers: [
    {
      url: "https://{host}/anything",
      variables: { host: { default: "httpbin.org" } },
    },
  ],
  paths: {
    "/projects": {
      get: {
        operationId: "listProjects",
        summary: "List projects",
        tags: ["Projects"],
      },
      post: {
        operationId: "createProject",
        summary: "Create project",
        tags: ["Projects"],
        requestBody: {
          content: { "application/json": { example: { name: "agent-draw" } } },
        },
      },
    },
    "/health": {
      get: { operationId: "getHealth", tags: ["Operations"] },
    },
  },
};

describe("OpenAPI importer", () => {
  it("creates stable endpoint, service, edge, capability, and provenance records", () => {
    const document = importOpenApi(fixture, { source: "projects.yaml" });
    expect(document.id).toBe("openapi-project-service");
    expect(
      document.nodes.filter((node) => node.type === "agent-draw.api/endpoint"),
    ).toHaveLength(3);
    expect(
      document.nodes.filter((node) => node.type === "agent-draw.core/service"),
    ).toHaveLength(2);
    expect(document.edges).toHaveLength(3);
    expect(document.capabilities).toEqual([
      {
        id: "http-runtime",
        kind: "network.http",
        config: { policy: "public-network-only" },
      },
    ]);
    const create = document.nodes.find(
      (node) => node.id === "endpoint-createproject",
    );
    expect(create?.data.url).toBe("https://httpbin.org/anything/projects");
    expect(create?.data.body).toBe('{\n  "name": "agent-draw"\n}');
    expect(create?.extensions["agent-draw.provenance"]).toMatchObject({
      source: "projects.yaml",
      method: "POST",
      path: "/projects",
    });
  });

  it("uses an explicit server override and rejects empty APIs", () => {
    const document = importOpenApi(fixture, {
      serverUrl: "https://api.example.com/v1/",
    });
    expect(
      document.nodes.find((node) => node.id === "endpoint-listprojects")?.data
        .url,
    ).toBe("https://api.example.com/v1/projects");
    expect(() =>
      importOpenApi({
        openapi: "3.1.0",
        info: { title: "Empty", version: "1" },
        paths: {},
      }),
    ).toThrow(/no importable/);
  });
});
