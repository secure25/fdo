import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    testTimeout: 30000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
