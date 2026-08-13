import { resolve } from "node:path";
import { createJiti } from "jiti";

const root = process.cwd();
const jiti = createJiti(import.meta.url, { alias: { "@": resolve(root, "src") } });
const { runArticleImportCli } = await jiti.import("./lib/high-intent-article-import.ts");

try {
  await runArticleImportCli(process.argv.slice(2), root);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Article import failed"}\n`);
  process.exitCode = 1;
}
