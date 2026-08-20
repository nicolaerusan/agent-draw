import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { formatDocument, parseDocument } from "../model/schema";

export function resolveAgentPath(root: string, requestedPath: string) {
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(absoluteRoot, requestedPath);
  const withinRoot = relative(absoluteRoot, absolutePath);
  if (withinRoot.startsWith("..") || isAbsolute(withinRoot))
    throw new Error(
      `Path must stay inside the configured root: ${requestedPath}`,
    );
  return absolutePath;
}

export async function readStructuredFile(root: string, requestedPath: string) {
  return parseYaml(
    await readFile(resolveAgentPath(root, requestedPath), "utf8"),
  ) as unknown;
}

export async function readDocumentFile(root: string, requestedPath: string) {
  return parseDocument(await readStructuredFile(root, requestedPath));
}

export async function writeDocumentFile(
  root: string,
  requestedPath: string,
  document: Parameters<typeof formatDocument>[0],
) {
  await writeFile(
    resolveAgentPath(root, requestedPath),
    formatDocument(document),
    "utf8",
  );
}
