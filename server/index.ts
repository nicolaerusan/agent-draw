import express from "express";
import { z } from "zod";
import { assertSafeHttpTarget } from "./security.js";

const app = express();
app.use(express.json({ limit: "256kb" }));

const requestSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().max(200_000).optional(),
});

app.get("/api/health", (_request, response) =>
  response.json({ ok: true, runtime: "agent-draw" }),
);

app.post("/api/execute", async (request, response) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success)
    return response.status(400).json({
      error: "Invalid HTTP capability request",
      issues: parsed.error.issues,
    });

  try {
    const target = await assertSafeHttpTarget(parsed.data.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const startedAt = performance.now();
    try {
      const upstream = await fetch(target, {
        method: parsed.data.method,
        headers: parsed.data.headers,
        body: ["GET", "DELETE"].includes(parsed.data.method)
          ? undefined
          : parsed.data.body,
        redirect: "error",
        signal: controller.signal,
      });
      const body = (await upstream.text()).slice(0, 1_000_000);
      return response.json({
        ok: upstream.ok,
        status: upstream.status,
        statusText: upstream.statusText,
        durationMs: Math.round(performance.now() - startedAt),
        headers: Object.fromEntries(upstream.headers.entries()),
        body,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return response.status(400).json({ error: message });
  }
});

const port = Number(process.env.AGENT_DRAW_RUNTIME_PORT || 4174);
app.listen(port, "127.0.0.1", () =>
  console.log(
    `agent-draw capability runtime listening on http://127.0.0.1:${port}`,
  ),
);
