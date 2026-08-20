import type { AgentDrawPlugin, NodeAppearance } from "./types";

export interface TableColumn {
  name: string;
  type: string;
  primaryKey?: boolean;
  foreignKey?: boolean;
  nullable?: boolean;
}

export function readTableColumns(data: Record<string, unknown>): TableColumn[] {
  if (!Array.isArray(data.columns)) return [];
  return data.columns.flatMap((column) => {
    if (!column || typeof column !== "object") return [];
    const candidate = column as Record<string, unknown>;
    if (
      typeof candidate.name !== "string" ||
      typeof candidate.type !== "string"
    )
      return [];
    return [
      {
        name: candidate.name,
        type: candidate.type,
        primaryKey: candidate.primaryKey === true,
        foreignKey: candidate.foreignKey === true,
        nullable: candidate.nullable === true,
      },
    ];
  });
}

const appearances: Record<string, NodeAppearance> = {
  "agent-draw.core/service": { color: "violet", icon: "S", eyebrow: "SERVICE" },
  "agent-draw.core/database": {
    color: "green",
    icon: "D",
    eyebrow: "DATABASE",
  },
  "agent-draw.core/table": { color: "orange", icon: "T", eyebrow: "TABLE" },
  "agent-draw.core/file": {
    color: "yellow",
    icon: "F",
    eyebrow: "SOURCE FILE",
  },
  "agent-draw.core/external": { color: "grey", icon: "X", eyebrow: "EXTERNAL" },
};

export const corePlugin: AgentDrawPlugin = {
  manifest: {
    id: "agent-draw.core",
    version: "0.1.0",
    hostApi: "^0.1",
    displayName: "Core architecture blocks",
    nodeTypes: Object.keys(appearances),
    edgeTypes: [
      "agent-draw.core/depends-on",
      "agent-draw.core/reads",
      "agent-draw.core/calls",
      "agent-draw.core/contains",
      "agent-draw.core/references",
    ],
    capabilities: [],
  },
  appearance(node) {
    return (
      appearances[node.type] ?? {
        color: "grey",
        icon: "?",
        eyebrow: "UNKNOWN TYPE",
      }
    );
  },
  createNode(type, index) {
    const appearance = appearances[type];
    if (!appearance) throw new Error(`Unsupported core node type: ${type}`);
    const ports =
      type === "agent-draw.core/service"
        ? [
            { id: "request", direction: "input" as const, label: "request" },
            { id: "calls", direction: "output" as const, label: "calls" },
          ]
        : type === "agent-draw.core/database"
          ? [
              { id: "query", direction: "input" as const, label: "query" },
              { id: "schema", direction: "output" as const, label: "schema" },
            ]
          : type === "agent-draw.core/table"
            ? [
                {
                  id: "database",
                  direction: "input" as const,
                  label: "database",
                },
                { id: "query", direction: "input" as const, label: "query" },
                {
                  id: "reference",
                  direction: "input" as const,
                  label: "reference",
                },
                {
                  id: "references",
                  direction: "output" as const,
                  label: "references",
                },
              ]
            : type === "agent-draw.core/file"
              ? [
                  {
                    id: "exports",
                    direction: "output" as const,
                    label: "exports",
                  },
                ]
              : [
                  {
                    id: "request",
                    direction: "input" as const,
                    label: "request",
                  },
                ];
    return {
      id: `${type.split("/")[1]}-${crypto.randomUUID().slice(0, 8)}`,
      type,
      label: `New ${appearance.eyebrow.toLowerCase()}`,
      position: {
        x: 80 + (index % 3) * 310,
        y: 560 + Math.floor(index / 3) * 150,
      },
      size:
        type === "agent-draw.core/table"
          ? { w: 270, h: 190 }
          : { w: 240, h: 112 },
      ports,
      data:
        type === "agent-draw.core/table"
          ? {
              columns: [
                { name: "id", type: "uuid", primaryKey: true },
                { name: "created_at", type: "datetime" },
              ],
            }
          : {},
      capabilityRefs: [],
      extensions: {},
    };
  },
  connect(source, sourcePortId, target, targetPortId) {
    if (source.type === "agent-draw.core/database") {
      const allowed =
        sourcePortId === "schema" &&
        target.type === "agent-draw.core/table" &&
        targetPortId === "database";
      return {
        allowed,
        edgeType: "agent-draw.core/contains",
        label: "contains",
        reason: allowed
          ? undefined
          : "A database schema can only contain a table",
      };
    }
    if (source.type === "agent-draw.core/table") {
      const allowed =
        sourcePortId === "references" &&
        target.type === "agent-draw.core/table" &&
        targetPortId === "reference";
      return {
        allowed,
        edgeType: "agent-draw.core/references",
        label: "references",
        reason: allowed
          ? undefined
          : "A table reference must target another table",
      };
    }
    if (source.type === "agent-draw.core/service") {
      if (
        target.type === "agent-draw.core/database" ||
        target.type === "agent-draw.core/table"
      )
        return {
          allowed: targetPortId === "query",
          edgeType: "agent-draw.core/reads",
          label: "reads",
          reason:
            targetPortId === "query"
              ? undefined
              : "A service read must target a query port",
        };
      return {
        allowed: true,
        edgeType: "agent-draw.core/calls",
        label: "calls",
      };
    }
    return {
      allowed: true,
      edgeType: "agent-draw.core/depends-on",
      label: "depends on",
    };
  },
};
