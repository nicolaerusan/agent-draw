import type { ApiNodeData } from "../plugins/api";

export interface HttpExecutionRequest {
  method: ApiNodeData["method"];
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpExecutionResult {
  ok: boolean;
  status: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  body: string;
}

export function buildHttpExecutionRequest(
  data: ApiNodeData,
): HttpExecutionRequest {
  const method = data.method;
  const hasBody =
    !["GET", "DELETE"].includes(method) && Boolean(data.body?.trim());
  const headers = { ...data.headers };
  if (
    hasBody &&
    data.body &&
    !Object.keys(headers).some((name) => name.toLowerCase() === "content-type")
  ) {
    try {
      JSON.parse(data.body);
      headers["content-type"] = "application/json";
    } catch {
      headers["content-type"] = "text/plain";
    }
  }
  return {
    method,
    url: data.url.trim(),
    headers,
    ...(hasBody ? { body: data.body } : {}),
  };
}

export async function executeHttpRequest(
  data: ApiNodeData,
): Promise<HttpExecutionResult> {
  const response = await fetch("/api/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildHttpExecutionRequest(data)),
  });
  const payload = (await response.json()) as HttpExecutionResult & {
    error?: string;
  };
  if (!response.ok)
    throw new Error(payload.error || `Runtime returned ${response.status}`);
  return payload;
}
