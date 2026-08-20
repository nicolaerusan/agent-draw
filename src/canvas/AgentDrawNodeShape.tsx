import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type RecordProps,
  type TLShape,
} from "tldraw";
import { pluginRegistry } from "../plugins/registry";
import { useCanvasDocument } from "./context";
import { canvasPorts } from "./ports";
import { readTableColumns } from "../plugins/core";

export const AGENT_DRAW_NODE_SHAPE = "agent-draw-node" as const;

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [AGENT_DRAW_NODE_SHAPE]: { nodeId: string; w: number; h: number };
  }
}

export type AgentDrawNodeShape = TLShape<typeof AGENT_DRAW_NODE_SHAPE>;

export class AgentDrawNodeShapeUtil extends BaseBoxShapeUtil<AgentDrawNodeShape> {
  static override type = AGENT_DRAW_NODE_SHAPE;
  static override props: RecordProps<AgentDrawNodeShape> = {
    nodeId: T.string,
    w: T.number,
    h: T.number,
  };

  override getDefaultProps(): AgentDrawNodeShape["props"] {
    return { nodeId: "missing", w: 240, h: 112 };
  }

  override canEdit() {
    return false;
  }

  override canResize() {
    return true;
  }

  override canBind() {
    return true;
  }

  override isAspectRatioLocked() {
    return false;
  }

  override component(shape: AgentDrawNodeShape) {
    return <AgentDrawNodeCard shape={shape} />;
  }

  override getIndicatorPath(shape: AgentDrawNodeShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, shape.props.h, 10);
    return path;
  }
}

function AgentDrawNodeCard({ shape }: { shape: AgentDrawNodeShape }) {
  const { document, beginConnection } = useCanvasDocument();
  const node = document.nodes.find(
    (candidate) => candidate.id === shape.props.nodeId,
  );
  if (!node)
    return (
      <HTMLContainer className="agent-node agent-node-missing">
        Missing node
      </HTMLContainer>
    );

  const plugin = pluginRegistry.forNodeType(node.type);
  const appearance = plugin?.appearance(node) ?? {
    color: "grey" as const,
    icon: "?",
    eyebrow: node.type,
  };
  const detail =
    node.type === "agent-draw.api/endpoint" && typeof node.data.url === "string"
      ? node.data.url
      : node.type;
  const tableColumns =
    node.type === "agent-draw.core/table" ? readTableColumns(node.data) : [];

  return (
    <HTMLContainer
      id={shape.id}
      className={`agent-node agent-node-${appearance.color}`}
      style={{
        width: shape.props.w,
        height: shape.props.h,
        pointerEvents: "all",
      }}
    >
      <div className="agent-node-heading">
        <span className="agent-node-icon">{appearance.icon}</span>
        <span>{appearance.eyebrow}</span>
      </div>
      <strong className="agent-node-title">{node.label}</strong>
      {node.type === "agent-draw.core/table" ? (
        <div className="agent-table-columns">
          {tableColumns.map((column) => (
            <div key={column.name}>
              <span className="column-flags">
                {column.primaryKey ? "PK" : column.foreignKey ? "FK" : ""}
              </span>
              <strong>{column.name}</strong>
              <span>{column.type}</span>
            </div>
          ))}
        </div>
      ) : (
        <span className="agent-node-detail">{detail}</span>
      )}
      {canvasPorts(node).map((port) => (
        <button
          key={port.portId}
          type="button"
          className={`agent-port agent-port-${port.side} agent-port-${port.direction}`}
          style={{ top: port.y }}
          aria-label={`${port.direction} port ${port.label}`}
          title={`${port.direction}: ${port.label}`}
          data-node-id={node.id}
          data-port-id={port.portId}
          onPointerDown={(event) => {
            if (port.direction === "input") return;
            event.preventDefault();
            event.stopPropagation();
            beginConnection({ nodeId: node.id, portId: port.portId }, event);
          }}
        >
          <i />
          <span>{port.label}</span>
        </button>
      ))}
    </HTMLContainer>
  );
}
