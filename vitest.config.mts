import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    fileParallelism: false,
    coverage: { reporter: ["text", "html"] },
  },
});
