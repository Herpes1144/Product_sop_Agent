import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const filesToCheck = [
  "api/[...route].ts",
  "server/http/router.ts",
  "server/ai/service.ts",
  "server/ai/fallbacks.ts",
  "server/data/backend.ts",
  "server/data/service.ts",
  "server/data/supabase-service.ts",
  "src/mock/action-map.ts",
  "src/mock/tickets.ts"
];

const relativeImportPattern =
  /from\s+["'](\.{1,2}\/[^"']+)["']|import\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;

function hasSupportedExtension(importPath: string) {
  return [".js", ".json", ".node", ".mjs", ".cjs"].some((extension) =>
    importPath.endsWith(extension)
  );
}

describe("NodeNext server imports", () => {
  test.each(filesToCheck)(
    "%s uses explicit file extensions for relative imports",
    async (relativeFilePath) => {
      const source = await readFile(resolve(process.cwd(), relativeFilePath), "utf-8");
      const imports = [...source.matchAll(relativeImportPattern)]
        .map((match) => match[1] ?? match[2] ?? "")
        .filter(Boolean);

      expect(imports.length).toBeGreaterThan(0);

      for (const importPath of imports) {
        expect(hasSupportedExtension(importPath)).toBe(true);
      }
    }
  );
});
