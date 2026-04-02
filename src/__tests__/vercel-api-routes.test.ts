import { access } from "node:fs/promises";
import { resolve } from "node:path";

const requiredApiFiles = [
  "api/bootstrap.ts",
  "api/demo/reset.ts",
  "api/ai/health.ts",
  "api/complaints.ts",
  "api/complaints/[...route].ts"
];

describe("Vercel API route entrypoints", () => {
  test.each(requiredApiFiles)("%s exists", async (relativePath) => {
    await expect(access(resolve(process.cwd(), relativePath))).resolves.toBeUndefined();
  });
});
