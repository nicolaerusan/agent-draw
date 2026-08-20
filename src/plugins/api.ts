import type { AgentDrawPlugin } from "./types";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface ApiNodeData {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
  description?: string;
}

export function readApiNodeData(data: Record<string, unknown>): ApiNodeData {
  const method = HTTP_METHODS.includes(data.method as HttpMethod)
    ? (data.method as HttpMethod)
    : "GET";
  return {
    method,
    url: typeof data.url === "string" ? data.url : "",
    headers:
      data.headers &&
      typeof data.headers === "object" &&
      !Array.isArray(data.headers)
        ? Object.fromEntries(
            Object.entries(data.headers).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            ),
          )
        : {},
    body: typeof data.body === "string" ? data.body : undefined,
    description:
      typeof data.description === "string" ? data.description : undefined,
  };
}

export const apiPlugin: AgentDrawPlugin = {
  manifest: {
    id: "agent-draw.api",
    version: "0.1.0",
    hostApi: "^0.1",
    displayName: "HTTP API routes",
    nodeTypes: ["agent-draw.api/endpoint"],
    edgeTypes: ["agent-draw.api/invokes"],
    capabilities: ["network.http"],
  },
  appearance() {
    return { color: "blue", icon: "→", eyebrow: "API ENDPOINT" };
  },
  createNode(_type, index) {
    return {
      id: `endpoint-${crypto.randomUUID().slice(0, 8)}`,
      type: "agent-draw.api/endpoint",
      label: "New endpoint",
      position: {
        x: 80 + (index % 3) * 310,
        y: 560 + Math.floor(index / 3) * 150,
      },
      size: { w: 260, h: 116 },
      ports: [
        { id: "request", direction: "input", label: "request" },
        { id: "invokes", direction: "output", label: "invokes" },
      ],
      data: { method: "GET", url: "https://httpbin.org/anything", headers: {} },
      capabilityRefs: ["http-runtime"],
      extensions: {},
    };
  },
  connect() {
    return {
      allowed: true,
      edgeType: "agent-draw.api/invokes",
      label: "invokes",
    };
  },
};
