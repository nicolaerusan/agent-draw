import { useEffect, useMemo, useState } from "react";
import type { AgentDrawNode } from "../model/schema";
import { HTTP_METHODS, readApiNodeData, type HttpMethod } from "../plugins/api";
import { pluginRegistry } from "../plugins/registry";
import { readTableColumns, type TableColumn } from "../plugins/core";
import { executeHttpRequest, type HttpExecutionResult } from "../runtime/http";

interface InspectorProps {
  node: AgentDrawNode | null;
  onUpdate: (
    nodeId: string,
    changes: { label?: string; data?: Record<string, unknown> },
  ) => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Inspector({ node, onUpdate }: InspectorProps) {
  if (!node) return <EmptyInspector />;
  if (node.type === "agent-draw.api/endpoint")
    return <ApiInspector key={node.id} node={node} onUpdate={onUpdate} />;
  if (node.type === "agent-draw.core/table")
    return <TableInspector key={node.id} node={node} onUpdate={onUpdate} />;
  return <GenericInspector node={node} onUpdate={onUpdate} />;
}

function TableInspector({
  node,
  onUpdate,
}: InspectorProps & { node: AgentDrawNode }) {
  const [label, setLabel] = useState(node.label);
  const [columns, setColumns] = useState<TableColumn[]>(() =>
    readTableColumns(node.data),
  );

  const updateColumn = (index: number, changes: Partial<TableColumn>) =>
    setColumns((current) =>
      current.map((column, candidate) =>
        candidate === index ? { ...column, ...changes } : column,
      ),
    );

  return (
    <aside className="inspector table-inspector">
      <div className="panel-kicker">DATABASE TABLE</div>
      <h2>{node.label}</h2>
      <div className="type-chip">{node.type}</div>
      <div className="rule" />
      <Field label="Table name">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </Field>
      <div className="table-editor-heading">
        <span>COLUMNS</span>
        <button
          type="button"
          onClick={() =>
            setColumns((current) => [
              ...current,
              { name: `column_${current.length + 1}`, type: "text" },
            ])
          }
        >
          + Add column
        </button>
      </div>
      <div className="table-editor">
        {columns.map((column, index) => (
          <div className="table-editor-row" key={index}>
            <input
              aria-label={`Column ${index + 1} name`}
              value={column.name}
              onChange={(event) =>
                updateColumn(index, { name: event.target.value })
              }
            />
            <input
              aria-label={`Column ${index + 1} type`}
              value={column.type}
              onChange={(event) =>
                updateColumn(index, { type: event.target.value })
              }
            />
            <label title="Primary key">
              <input
                type="checkbox"
                checked={column.primaryKey ?? false}
                onChange={(event) =>
                  updateColumn(index, { primaryKey: event.target.checked })
                }
              />
              PK
            </label>
            <label title="Foreign key">
              <input
                type="checkbox"
                checked={column.foreignKey ?? false}
                onChange={(event) =>
                  updateColumn(index, { foreignKey: event.target.checked })
                }
              />
              FK
            </label>
            <button
              type="button"
              aria-label={`Remove ${column.name}`}
              onClick={() =>
                setColumns((current) =>
                  current.filter((_, candidate) => candidate !== index),
                )
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        className="primary-button"
        onClick={() =>
          onUpdate(node.id, { label, data: { ...node.data, columns } })
        }
      >
        Save table
      </button>
      <p className="table-help">
        Connect database → table for ownership, service → table for reads, and
        table → table for foreign-key relationships.
      </p>
    </aside>
  );
}

function EmptyInspector() {
  return (
    <aside className="inspector empty-inspector">
      <div className="panel-kicker">INSPECTOR</div>
      <div className="empty-glyph">⌁</div>
      <h2>Select a block</h2>
      <p>
        Click a semantic block to inspect its data, plugin, and available
        utilities.
      </p>
    </aside>
  );
}

function GenericInspector({
  node,
  onUpdate,
}: InspectorProps & { node: AgentDrawNode }) {
  const plugin = pluginRegistry.forNodeType(node.type);
  const [label, setLabel] = useState(node.label);
  return (
    <aside className="inspector">
      <div className="panel-kicker">
        {plugin?.appearance(node).eyebrow ?? "UNKNOWN BLOCK"}
      </div>
      <h2>{node.label}</h2>
      <div className="type-chip">{node.type}</div>
      <div className="rule" />
      <Field label="Label">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </Field>
      <button
        className="primary-button"
        onClick={() => onUpdate(node.id, { label })}
      >
        Save block
      </button>
      <div className="data-preview">
        <span>PLUGIN DATA</span>
        <pre>{JSON.stringify(node.data, null, 2)}</pre>
      </div>
    </aside>
  );
}

function ApiInspector({
  node,
  onUpdate,
}: InspectorProps & { node: AgentDrawNode }) {
  const initial = useMemo(() => readApiNodeData(node.data), [node.data]);
  const [label, setLabel] = useState(node.label);
  const [method, setMethod] = useState<HttpMethod>(initial.method);
  const [url, setUrl] = useState(initial.url);
  const [headers, setHeaders] = useState(
    JSON.stringify(initial.headers, null, 2),
  );
  const [body, setBody] = useState(initial.body ?? "");
  const [result, setResult] = useState<HttpExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setSaved(false), [label, method, url, headers, body]);

  const parseHeaders = () => {
    const parsed = JSON.parse(headers || "{}") as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      Object.values(parsed).some((value) => typeof value !== "string")
    ) {
      throw new Error("Headers must be a JSON object with string values");
    }
    return parsed as Record<string, string>;
  };

  const save = () => {
    try {
      const nextHeaders = parseHeaders();
      onUpdate(node.id, {
        label,
        data: { ...node.data, method, url, headers: nextHeaders, body },
      });
      setError(null);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    }
  };

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const nextHeaders = parseHeaders();
      setResult(
        await executeHttpRequest({ method, url, headers: nextHeaders, body }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <aside className="inspector api-inspector">
      <div className="panel-kicker">API ENDPOINT</div>
      <div className="inspector-title-row">
        <span className={`method method-${method.toLowerCase()}`}>
          {method}
        </span>
        <h2>{node.label}</h2>
      </div>
      <p className="description">
        {initial.description || "An executable HTTP capability."}
      </p>
      <div className="rule" />
      <Field label="Block label">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </Field>
      <div className="request-line">
        <select
          aria-label="Method"
          value={method}
          onChange={(event) => setMethod(event.target.value as HttpMethod)}
        >
          {HTTP_METHODS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <input
          aria-label="Request URL"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </div>
      <Field label="Headers (JSON)">
        <textarea
          rows={4}
          value={headers}
          onChange={(event) => setHeaders(event.target.value)}
          spellCheck={false}
        />
      </Field>
      {!["GET", "DELETE"].includes(method) && (
        <Field label="Body">
          <textarea
            rows={6}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            spellCheck={false}
          />
        </Field>
      )}
      <div className="action-row">
        <button
          className="primary-button run-button"
          onClick={run}
          disabled={running}
        >
          {running ? "Running…" : "▶ Run request"}
        </button>
        <button className="secondary-button" onClick={save}>
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      <p className="policy-note">
        Public network only · 15s timeout · redirects blocked
      </p>
      {error && (
        <div className="response error-response">
          <strong>REQUEST ERROR</strong>
          <p>{error}</p>
        </div>
      )}
      {result && (
        <div className="response">
          <div className="response-head">
            <strong>
              {result.status} {result.statusText}
            </strong>
            <span>{result.durationMs} ms</span>
          </div>
          <pre>{prettyBody(result.body)}</pre>
        </div>
      )}
    </aside>
  );
}

function prettyBody(body: string) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
