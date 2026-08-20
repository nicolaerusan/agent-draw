#!/usr/bin/env -S node --import tsx

import { readFile, writeFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { proposeConnection } from "../src/agent/connections";
import { importOpenApi } from "../src/importers/openapi";
import { diffDocuments } from "../src/model/diff";
import { applyPatch, graphPatchSchema } from "../src/model/patch";
import { formatDocument, parseDocument } from "../src/model/schema";

interface ParsedArguments {
  positionals: string[];
  options: Map<string, string | true>;
}

function parseArguments(args: string[]): ParsedArguments {
  const positionals: string[] = [];
  const options = new Map<string, string | true>();
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (value === "-o") {
      const next = args[++index];
      if (!next) throw new Error("-o requires a file path");
      options.set("output", next);
    } else if (value.startsWith("--")) {
      const [name, inline] = value.slice(2).split("=", 2);
      if (inline !== undefined) options.set(name, inline);
      else if (args[index + 1] && !args[index + 1].startsWith("-"))
        options.set(name, args[++index]);
      else options.set(name, true);
    } else positionals.push(value);
  }
  return { positionals, options };
}

async function readStructured(path: string) {
  return parseYaml(await readFile(path, "utf8")) as unknown;
}

async function emit(content: string, output?: string) {
  if (output) await writeFile(output, content, "utf8");
  else process.stdout.write(content);
}

function outputPath(args: ParsedArguments) {
  const output = args.options.get("output");
  return typeof output === "string" ? output : undefined;
}

function help() {
  return `agent-draw — agent-first technical diagram tooling

Usage:
  agent-draw validate <document>
  agent-draw format <document> [--write | -o <file>]
  agent-draw apply <document> <patch> [--dry-run | --write | -o <file>]
  agent-draw diff <before> <after> [-o <patch>]
  agent-draw connect <document> --source <node/port> --target <node/port> [-o <patch>]
  agent-draw import-openapi <openapi.yaml> [--server <url>] [-o <document>]
`;
}

function portReference(value: string | true | undefined, option: string) {
  if (typeof value !== "string")
    throw new Error(`${option} requires node/port`);
  const separator = value.lastIndexOf("/");
  if (separator <= 0 || separator === value.length - 1)
    throw new Error(`${option} must use node/port`);
  return {
    nodeId: value.slice(0, separator),
    portId: value.slice(separator + 1),
  };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    process.stdout.write(help());
    return;
  }
  const args = parseArguments(rest);

  switch (command) {
    case "validate": {
      const [path] = args.positionals;
      if (!path) throw new Error("validate requires a document path");
      const document = parseDocument(await readStructured(path));
      process.stdout.write(
        `valid ${document.format}/${document.version} · ${document.nodes.length} nodes · ${document.edges.length} edges · revision ${document.revision}\n`,
      );
      break;
    }
    case "format": {
      const [path] = args.positionals;
      if (!path) throw new Error("format requires a document path");
      const content = formatDocument(parseDocument(await readStructured(path)));
      await emit(content, args.options.has("write") ? path : outputPath(args));
      break;
    }
    case "apply": {
      const [documentPath, patchPath] = args.positionals;
      if (!documentPath || !patchPath)
        throw new Error("apply requires a document path and patch path");
      const document = parseDocument(await readStructured(documentPath));
      const patch = graphPatchSchema.parse(await readStructured(patchPath));
      const next = applyPatch(document, patch);
      if (args.options.has("dry-run")) {
        process.stdout.write(
          `dry run ok · ${patch.operations.length} operations · revision ${document.revision} → ${next.revision} · ${next.nodes.length} nodes · ${next.edges.length} edges\n`,
        );
      } else {
        await emit(
          formatDocument(next),
          args.options.has("write") ? documentPath : outputPath(args),
        );
      }
      break;
    }
    case "diff": {
      const [beforePath, afterPath] = args.positionals;
      if (!beforePath || !afterPath)
        throw new Error("diff requires before and after document paths");
      const patch = diffDocuments(
        parseDocument(await readStructured(beforePath)),
        parseDocument(await readStructured(afterPath)),
      );
      await emit(`${JSON.stringify(patch, null, 2)}\n`, outputPath(args));
      break;
    }
    case "connect": {
      const [path] = args.positionals;
      if (!path) throw new Error("connect requires a document path");
      const document = parseDocument(await readStructured(path));
      const patch = proposeConnection(
        document,
        portReference(args.options.get("source"), "--source"),
        portReference(args.options.get("target"), "--target"),
      );
      await emit(`${JSON.stringify(patch, null, 2)}\n`, outputPath(args));
      break;
    }
    case "import-openapi": {
      const [path] = args.positionals;
      if (!path)
        throw new Error("import-openapi requires an OpenAPI file path");
      const server = args.options.get("server");
      const document = importOpenApi(await readStructured(path), {
        source: path,
        ...(typeof server === "string" ? { serverUrl: server } : {}),
      });
      await emit(formatDocument(document), outputPath(args));
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}\n\n${help()}`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `agent-draw: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
