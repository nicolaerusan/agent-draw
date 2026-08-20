import { useEffect, useMemo, useRef, useState } from "react";
import { proposeConnection } from "./agent/connections";
import type { PortReference } from "./canvas/context";
import { CanvasView } from "./components/CanvasView";
import { Inspector } from "./components/Inspector";
import { seedDocument } from "./data";
import {
  formatDocument,
  parseDocument,
  type AgentDrawDocument,
} from "./model/schema";
import { applyPatch } from "./model/patch";
import { pluginRegistry } from "./plugins/registry";
import { canvasSamples, freshSample, sampleSlugFromLocation } from "./samples";
import type { CanvasNodeLayout } from "./canvasAdapter";

const STORAGE_KEY = "agent-draw.document.v0.1";

function loadDocument() {
  try {
    const sampleSlug = sampleSlugFromLocation();
    if (sampleSlug) return freshSample(sampleSlug);
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseDocument(JSON.parse(saved)) : seedDocument;
  } catch {
    return seedDocument;
  }
}

export default function App() {
  const [document, setDocument] = useState<AgentDrawDocument>(loadDocument);
  const [activeSampleSlug, setActiveSampleSlug] = useState<string | null>(
    sampleSlugFromLocation,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    "endpoint-list-projects",
  );
  const [renderKey, setRenderKey] = useState(0);
  const [notice, setNotice] = useState("Seed system map loaded");
  const importInput = useRef<HTMLInputElement>(null);
  const selectedNode = useMemo(
    () => document.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [document, selectedNodeId],
  );

  useEffect(
    () => localStorage.setItem(STORAGE_KEY, formatDocument(document)),
    [document],
  );

  const updateNode = (
    nodeId: string,
    changes: { label?: string; data?: Record<string, unknown> },
  ) => {
    setDocument((current) => ({
      ...current,
      revision: current.revision + 1,
      nodes: current.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, ...changes, data: changes.data ?? node.data }
          : node,
      ),
    }));
    setRenderKey((value) => value + 1);
    setNotice("Block saved to canonical document");
  };

  const updateLayout = (layouts: CanvasNodeLayout[]) => {
    setDocument((current) => {
      const layoutByNode = new Map(
        layouts.map((layout) => [layout.nodeId, layout]),
      );
      const changed = current.nodes.some((node) => {
        const layout = layoutByNode.get(node.id);
        return (
          layout &&
          (Math.abs(node.position.x - layout.x) > 0.5 ||
            Math.abs(node.position.y - layout.y) > 0.5 ||
            Math.abs(node.size.w - layout.w) > 0.5 ||
            Math.abs(node.size.h - layout.h) > 0.5)
        );
      });
      if (!changed) return current;
      return {
        ...current,
        revision: current.revision + 1,
        nodes: current.nodes.map((node) => {
          const layout = layoutByNode.get(node.id);
          return layout
            ? {
                ...node,
                position: { x: layout.x, y: layout.y },
                size: { w: layout.w, h: layout.h },
              }
            : node;
        }),
      };
    });
  };

  const connectNodes = (source: PortReference, target: PortReference) => {
    try {
      setDocument((current) =>
        applyPatch(current, proposeConnection(current, source, target)),
      );
      setRenderKey((value) => value + 1);
      setNotice(
        `Connected ${source.nodeId}/${source.portId} → ${target.nodeId}/${target.portId}`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Connection rejected: ${error.message}`
          : "Connection rejected",
      );
    }
  };

  const addNode = (type: string) => {
    const plugin = pluginRegistry.forNodeType(type);
    if (!plugin) return;
    const node = plugin.createNode(type, document.nodes.length);
    setDocument((current) => ({
      ...current,
      revision: current.revision + 1,
      nodes: [...current.nodes, node],
    }));
    setSelectedNodeId(node.id);
    setRenderKey((value) => value + 1);
    setNotice(`${plugin.appearance(node).eyebrow.toLowerCase()} added`);
  };

  const exportDocument = () => {
    const blob = new Blob([formatDocument(document)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${document.id}.agent-draw.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Canonical JSON exported");
  };

  const importDocument = async (file: File) => {
    try {
      const imported = parseDocument(JSON.parse(await file.text()));
      setDocument(imported);
      setActiveSampleSlug(null);
      window.history.replaceState({}, "", window.location.pathname);
      setSelectedNodeId(null);
      setRenderKey((value) => value + 1);
      setNotice(
        `Imported ${imported.nodes.length} nodes · ${imported.edges.length} edges`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Import failed: ${error.message}`
          : "Import failed",
      );
    }
  };

  const loadSample = (slug: string) => {
    if (!canvasSamples[slug]) return;
    const sample = freshSample(slug);
    setDocument(sample);
    setActiveSampleSlug(slug);
    setSelectedNodeId(null);
    setRenderKey((value) => value + 1);
    window.history.replaceState({}, "", `?sample=${encodeURIComponent(slug)}`);
    setNotice(
      `Loaded ${canvasSamples[slug].label} · ${sample.nodes.length} nodes · ${sample.edges.length} edges`,
    );
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <i />
            <i />
            <i />
          </div>
          <span>agent-draw</span>
          <em>alpha</em>
        </div>
        <div className="document-title">
          <span>SPACE</span>
          <strong>{document.title}</strong>
        </div>
        <div className="top-actions">
          <span className="save-state">● SAVED LOCALLY</span>
          <label className="sample-picker">
            <span>SAMPLE</span>
            <select
              aria-label="Sample canvas"
              value={activeSampleSlug ?? ""}
              onChange={(event) =>
                event.target.value && loadSample(event.target.value)
              }
            >
              <option value="" disabled>
                Choose a canvas…
              </option>
              {Object.entries(canvasSamples).map(([slug, sample]) => (
                <option key={slug} value={slug}>
                  {sample.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="quiet-button"
            onClick={() => importInput.current?.click()}
          >
            Import
          </button>
          <button className="export-button" onClick={exportDocument}>
            Export JSON ↗
          </button>
          <input
            ref={importInput}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(event) =>
              event.target.files?.[0] &&
              void importDocument(event.target.files[0])
            }
          />
        </div>
      </header>
      <section className="workspace">
        <aside className="library">
          <div className="panel-kicker">DRAWING PLUGINS</div>
          <h1>System blocks</h1>
          <p>Semantic primitives agents can read, patch, and connect.</p>
          <div className="block-list">
            <button onClick={() => addNode("agent-draw.api/endpoint")}>
              <span className="block-icon blue">→</span>
              <span>
                <strong>API endpoint</strong>
                <small>Inspect & execute HTTP</small>
              </span>
              <b>+</b>
            </button>
            <button onClick={() => addNode("agent-draw.core/service")}>
              <span className="block-icon violet">S</span>
              <span>
                <strong>Service</strong>
                <small>Runtime or application</small>
              </span>
              <b>+</b>
            </button>
            <button onClick={() => addNode("agent-draw.core/database")}>
              <span className="block-icon green">D</span>
              <span>
                <strong>Database</strong>
                <small>Schema & data ownership</small>
              </span>
              <b>+</b>
            </button>
            <button onClick={() => addNode("agent-draw.core/table")}>
              <span className="block-icon orange">T</span>
              <span>
                <strong>Table</strong>
                <small>Columns & relationships</small>
              </span>
              <b>+</b>
            </button>
            <button onClick={() => addNode("agent-draw.core/file")}>
              <span className="block-icon yellow">F</span>
              <span>
                <strong>Source file</strong>
                <small>Modules & dependencies</small>
              </span>
              <b>+</b>
            </button>
          </div>
          <div className="plugin-summary">
            <span>ACTIVE PLUGINS</span>
            {pluginRegistry.list().map((plugin) => (
              <div key={plugin.manifest.id}>
                <i className="status-dot" />
                <strong>{plugin.manifest.displayName}</strong>
                <small>v{plugin.manifest.version}</small>
              </div>
            ))}
          </div>
          <div className="format-card">
            <span>AGENT FORMAT</span>
            <strong>agent-draw / 0.1</strong>
            <small>
              {document.nodes.length} nodes · {document.edges.length} edges
            </small>
          </div>
        </aside>
        <CanvasView
          document={document}
          renderKey={renderKey}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onLayoutNodes={updateLayout}
          onConnect={connectNodes}
        />
        <Inspector node={selectedNode} onUpdate={updateNode} />
      </section>
      <footer className="statusbar">
        <span>{notice}</span>
        <span>
          Canvas: tldraw · Source of truth: canonical JSON · Runtime policy:
          public network
        </span>
      </footer>
    </main>
  );
}
