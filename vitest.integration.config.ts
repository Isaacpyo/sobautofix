import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    maxWorkers: 1,
    hookTimeout: 60_000,
    testTimeout: 90_000,
  },
});
