import type { AgentDrawNode } from "../model/schema";

export type CapabilityKind =
  "network.http" | "workspace.read" | "connector.invoke";

export interface PluginManifest {
  id: string;
  version: string;
  hostApi: string;
  displayName: string;
  nodeTypes: string[];
  edgeTypes: string[];
  capabilities: CapabilityKind[];
}

export interface NodeAppearance {
  color: "blue" | "green" | "orange" | "red" | "violet" | "yellow" | "grey";
  icon: string;
  eyebrow: string;
}

export interface ConnectionDecision {
  allowed: boolean;
  edgeType: string;
  label?: string;
  reason?: string;
}

export interface AgentDrawPlugin {
  manifest: PluginManifest;
  appearance(node: AgentDrawNode): NodeAppearance;
  createNode(type: string, index: number): AgentDrawNode;
  connect?(
    source: AgentDrawNode,
    sourcePortId: string,
    target: AgentDrawNode,
    targetPortId: string,
  ): ConnectionDecision;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, AgentDrawPlugin>();

  register(plugin: AgentDrawPlugin) {
    if (this.plugins.has(plugin.manifest.id))
      throw new Error(`Plugin already registered: ${plugin.manifest.id}`);
    this.plugins.set(plugin.manifest.id, plugin);
  }

  forNodeType(nodeType: string): AgentDrawPlugin | undefined {
    return [...this.plugins.values()].find((plugin) =>
      plugin.manifest.nodeTypes.includes(nodeType),
    );
  }

  list() {
    return [...this.plugins.values()];
  }

  connectionDecision(
    source: AgentDrawNode,
    sourcePortId: string,
    target: AgentDrawNode,
    targetPortId: string,
  ): ConnectionDecision {
    const plugin = this.forNodeType(source.type);
    if (!plugin?.connect) {
      return {
        allowed: false,
        edgeType: "agent-draw.core/depends-on",
        reason: `${source.type} does not declare connection behavior`,
      };
    }
    const decision = plugin.connect(source, sourcePortId, target, targetPortId);
    if (!plugin.manifest.edgeTypes.includes(decision.edgeType)) {
      throw new Error(
        `Plugin ${plugin.manifest.id} returned undeclared edge type ${decision.edgeType}`,
      );
    }
    return decision;
  }
}
