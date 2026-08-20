import agentCanvasLoopInput from "../examples/canvases/agent-canvas-loop.agent-draw.json";
import pluginSystemInput from "../examples/canvases/bb-plugin-system.agent-draw.json";
import openApiProjectInput from "../examples/canvases/openapi-project-service.agent-draw.json";
import { seedDocument } from "./data";
import { parseDocument, type AgentDrawDocument } from "./model/schema";

export interface CanvasSample {
  label: string;
  description: string;
  document: AgentDrawDocument;
}

export const canvasSamples: Record<string, CanvasSample> = {
  "system-map": {
    label: "System map",
    description: "API, service, database, source file, and connector",
    document: seedDocument,
  },
  "agent-loop": {
    label: "Human + agent loop",
    description: "How project context becomes a shared interactive canvas",
    document: parseDocument(agentCanvasLoopInput),
  },
  "plugin-system": {
    label: "BB-style plugins",
    description: "Manifest, host surfaces, agent tools, and capabilities",
    document: parseDocument(pluginSystemInput),
  },
  "openapi-projects": {
    label: "OpenAPI project service",
    description: "An API map imported from OpenAPI 3.1",
    document: parseDocument(openApiProjectInput),
  },
};

export function sampleSlugFromLocation() {
  const slug = new URLSearchParams(window.location.search).get("sample");
  return slug && canvasSamples[slug] ? slug : null;
}

export function freshSample(slug: string) {
  const sample = canvasSamples[slug];
  if (!sample) throw new Error(`Unknown sample: ${slug}`);
  return structuredClone(sample.document);
}
