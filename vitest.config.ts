import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/empty.ts") } },
  test: { include: ["tests/**/*.test.ts"], fileParallelism: false },   // DB integration files share one database: run them one at a time
});
