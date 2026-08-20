import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

function run(...args: string[]) {
  return execFileSync(
    process.execPath,
    ["--import", "tsx", resolve("bin/agent-draw.ts"), ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("agent-draw CLI", () => {
  it("imports, validates, formats, diffs, dry-runs, and applies documents", () => {
    const directory = mkdtempSync(join(tmpdir(), "agent-draw-cli-"));
    temporaryDirectories.push(directory);
    const beforePath = join(directory, "before.json");
    const afterPath = join(directory, "after.json");
    const patchPath = join(directory, "change.patch.json");
    const appliedPath = join(directory, "applied.json");
    const connectionPath = join(directory, "connection.patch.json");

    run("import-openapi", "examples/openapi/projects.yaml", "-o", beforePath);
    expect(run("validate", beforePath)).toMatch(
      /valid agent-draw\/0.1 · 5 nodes · 3 edges/,
    );
    run("format", beforePath, "--write");

    run(
      "connect",
      beforePath,
      "--source",
      "service-projects/calls",
      "--target",
      "service-operations/request",
      "-o",
      connectionPath,
    );
    const connection = JSON.parse(readFileSync(connectionPath, "utf8")) as {
      operations: Array<{ op: string }>;
    };
    expect(connection.operations).toEqual([
      expect.objectContaining({ op: "connect" }),
    ]);

    const after = JSON.parse(readFileSync(beforePath, "utf8")) as Record<
      string,
      unknown
    >;
    after.title = "Edited API map";
    after.revision = 1;
    writeFileSync(afterPath, `${JSON.stringify(after, null, 2)}\n`);

    run("diff", beforePath, afterPath, "-o", patchPath);
    expect(run("apply", beforePath, patchPath, "--dry-run")).toMatch(
      /dry run ok · 1 operations · revision 0 → 1/,
    );
    run("apply", beforePath, patchPath, "-o", appliedPath);
    expect(JSON.parse(readFileSync(appliedPath, "utf8"))).toEqual(after);
  });
});
