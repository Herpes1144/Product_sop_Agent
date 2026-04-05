import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const filesToCheck = [
  "api/_shared.ts",
  "api/[...route].ts",
  "api/bootstrap.ts",
  "api/complaints.ts",
  "api/complaints/[...route].ts",
  "api/ai/health.ts",
  "api/demo/reset.ts",
  "server/index.ts",
  "server/http/router.ts",
  "server/ai/service.ts",
  "server/ai/fallbacks.ts",
  "src/lib/sandbox-store.ts",
  "src/mock/action-map.ts",
  "src/mock/demo-paths.ts",
  "src/mock/issue-types.ts",
  "src/mock/knowledge-base.ts",
  "src/mock/status-map.ts",
  "src/mock/tickets.ts",
  "src/types/ai.ts",
  "src/types/sandbox.ts",
  "src/types/workbench.ts"
];

const extensionlessRelativeImportPattern =
  /from\s+["'](\.{1,2}\/[^"']+?)(?<!\.(?:js|json|node))["']/g;

describe("vercel server import compatibility", () => {
  it("does not leave extensionless relative imports in api/server modules", () => {
    const offenders = filesToCheck.flatMap((filePath) => {
      const content = readFileSync(join(rootDir, filePath), "utf-8");
      const matches = [...content.matchAll(extensionlessRelativeImportPattern)];

      return matches.map((match) => `${filePath}:${match[1]}`);
    });

    expect(offenders).toEqual([]);
  });
});
