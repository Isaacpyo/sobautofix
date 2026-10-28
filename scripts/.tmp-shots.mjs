// Temporary local screenshot helper (not committed). Usage:
//   node scripts/.tmp-shots.mjs <name>=<path>[@mobile] ...
import { chromium } from "@playwright/test";

const base = process.env.BASE || "http://localhost:3102";
const out = "/tmp/claude-0/-home-user/b51fe994-bbc5-5638-87c5-e30e82446787/scratchpad/screens/admin";
const email = process.env.LOGIN || "sobautofix@gmail.com";
const password = "Local-only-9f2e7c4a!";

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
async function session(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${base}/admin/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((url) => !url.pathname.startsWith("/admin/login"), { timeout: 60000 }), page.click('button[type="submit"]')]);
  return page;
}
const desktop = await session({ width: 1280, height: 800 });
const mobile = await session({ width: 390, height: 844 });
for (const arg of process.argv.slice(2)) {
  const [name, rest] = arg.split("=");
  const [path, mode] = rest.split("@");
  const page = mode === "mobile" ? mobile : desktop;
  await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: mode !== "viewport" });
  console.log("saved", name);
}
await browser.close();
