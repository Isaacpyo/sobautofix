import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const vitest = resolve("node_modules/vitest/vitest.mjs");
const result = spawnSync(process.execPath, [vitest, "run", "src/__tests__/email-templates.test.ts"], {
  cwd: process.cwd(),
  env: { ...process.env, EMAIL_PREVIEW_DIR: ".email-previews" },
  stdio: "inherit",
});

process.exitCode = result.status ?? 1;
