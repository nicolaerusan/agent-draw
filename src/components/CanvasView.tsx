import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  createShapeId,
  Tldraw,
  type Editor,
  type TLPointerEventInfo,
  type TLShapeId,
} from "tldraw";
import "tldraw/tldraw.css";
import { AgentDrawNodeShapeUtil } from "../canvas/AgentDrawNodeShape";
import { CanvasDocumentContext, type PortReference } from "../canvas/context";
import { canvasPorts, portPagePoint } from "../canvas/ports";
import {
  canvasNodeLayouts,
  renderDocument,
  selectNode,
  selectedNodeId as readSelectedNodeId,
  type CanvasNodeLayout,
} from "../canvasAdapter";
import type { AgentDrawDocument } from "../model/schema";

const canvasComponents = { StylePanel: null };
const shapeUtils = [AgentDrawNodeShapeUtil];

interface CanvasViewProps {
  document: AgentDrawDocument;
  renderKey: number;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onLayoutNodes: (layouts: CanvasNodeLayout[]) => void;
  onConnect: (source: PortReference, target: PortReference) => void;
}

export function CanvasView({
  document,
  renderKey,
  selectedNodeId,
  onSelectNode,
  onLayoutNodes,
  onConnect,
}: CanvasViewProps) {
  const editorRef = useRef<Editor | null>(null);
  const renderingRef = useRef(false);
  const documentRef = useRef(document);
  const callbacksRef = useRef({ onSelectNode, onLayoutNodes, onConnect });
  documentRef.current = document;
  callbacksRef.current = { onSelectNode, onLayoutNodes, onConnect };

  const beginConnection = useCallback((source: PortReference) => {
    const editor = editorRef.current;
    const sourceNode = documentRef.current.nodes.find(
      (node) => node.id === source.nodeId,
    );
    if (!editor || !sourceNode) return;

    const start = portPagePoint(sourceNode, source.portId);
    const previewId = createShapeId(`agent-draw-preview-${Date.now()}`);
    editor.createShape({
      id: previewId,
      type: "arrow",
      x: start.x,
      y: start.y,
      isLocked: true,
      props: {
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
        color: "blue",
        dash: "dashed",
        size: "s",
        arrowheadEnd: "arrow",
      },
    });

    let candidate: PortReference | null = null;
    const nearestTarget = (point: { x: number; y: number }) => {
      const maxDistance = 38 / editor.getZoomLevel();
      let nearest: { reference: PortReference; distance: number } | null = null;
      for (const node of documentRef.current.nodes) {
        if (node.id === source.nodeId) continue;
        for (const port of canvasPorts(node)) {
          if (port.direction === "output") continue;
          const target = portPagePoint(node, port.portId);
          const distance = Math.hypot(target.x - point.x, target.y - point.y);
          if (
            distance <= maxDistance &&
            (!nearest || distance < nearest.distance)
          ) {
            nearest = {
              reference: { nodeId: node.id, portId: port.portId },
              distance,
            };
          }
        }
      }
      return nearest?.reference ?? null;
    };
    const move = (event: PointerEvent) => {
      const point = editor.screenToPage({ x: event.clientX, y: event.clientY });
      candidate = nearestTarget(point);
      const snappedNode = candidate
        ? documentRef.current.nodes.find(
            (node) => node.id === candidate?.nodeId,
          )
        : null;
      const end = snappedNode
        ? portPagePoint(snappedNode, candidate?.portId)
        : point;
      editor.updateShape({
        id: previewId,
        type: "arrow",
        props: { end: { x: end.x - start.x, y: end.y - start.y } },
      });
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (editor.getShape(previewId))
        editor.deleteShape(previewId as TLShapeId);
      if (candidate) callbacksRef.current.onConnect(source, candidate);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  }, []);

  const contextValue = useMemo(
    () => ({ document, beginConnection }),
    [document, beginConnection],
  );

  useEffect(() => {
    if (editorRef.current) {
      renderingRef.current = true;
      renderDocument(editorRef.current, documentRef.current);
      if (
        selectedNodeId &&
        documentRef.current.nodes.some((node) => node.id === selectedNodeId)
      )
        selectNode(editorRef.current, selectedNodeId);
      queueMicrotask(() => {
        renderingRef.current = false;
      });
    }
  }, [renderKey]);

  return (
    <div className="canvas-shell" data-testid="canvas">
      <CanvasDocumentContext.Provider value={contextValue}>
        <Tldraw
          components={canvasComponents}
          shapeUtils={shapeUtils}
          persistenceKey="agent-draw-tldraw-ui"
          onMount={(editor) => {
            editorRef.current = editor;
            renderingRef.current = true;
            renderDocument(editor, documentRef.current);
            if (
              selectedNodeId &&
              documentRef.current.nodes.some(
                (node) => node.id === selectedNodeId,
              )
            )
              selectNode(editor, selectedNodeId);
            queueMicrotask(() => {
              renderingRef.current = false;
            });
            let lastSelection: string | null = null;
            editor.store.listen(() => {
              if (renderingRef.current) return;
              const selection = readSelectedNodeId(editor);
              if (selection !== lastSelection) {
                lastSelection = selection;
                callbacksRef.current.onSelectNode(selection);
              }
            });
            editor.on("event", (info) => {
              if (
                !renderingRef.current &&
                info.name === "pointer_up" &&
                (info as TLPointerEventInfo).target !== "canvas"
              ) {
                callbacksRef.current.onLayoutNodes(canvasNodeLayouts(editor));
              }
            });
          }}
        />
      </CanvasDocumentContext.Provider>
      <div className="canvas-status">
        <span className="status-dot" />
        LIVE DOCUMENT · REV {document.revision}
      </div>
    </div>
  );
}
