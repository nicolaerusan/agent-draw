import {
  createContext,
  useContext,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AgentDrawDocument } from "../model/schema";

export interface PortReference {
  nodeId: string;
  portId: string;
}

export interface CanvasDocumentContextValue {
  document: AgentDrawDocument;
  beginConnection: (source: PortReference, event: ReactPointerEvent) => void;
}

export const CanvasDocumentContext =
  createContext<CanvasDocumentContextValue | null>(null);

export function useCanvasDocument() {
  const context = useContext(CanvasDocumentContext);
  if (!context)
    throw new Error(
      "AgentDrawNodeShape must be rendered inside CanvasDocumentContext",
    );
  return context;
}
