/* Browser end-to-end smoke test against a running server (ideally the demo DB: npm run dev:demo).
   Usage: [CHROME_PATH=/path/to/chrome] node scripts/e2e.mjs [baseUrl] [screenshotDir]  */
import { chromium } from "playwright-core";
import fs from "node:fs";

const base = process.argv[2] ?? "http://127.0.0.1:3210";
const shots = process.argv[3] ?? "data/screenshots";
fs.mkdirSync(shots, { recursive: true });

const executablePath = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: "dark" });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

const step = async (name, fn) => {
  process.stdout.write(`- ${name} … `);
  await fn();
  console.log("ok");
};
const stamp = Date.now().toString(36);

// ---- Todos (grouped by project) ----
await step("open /todos", async () => { await page.goto(`${base}/todos`); await page.waitForSelector("text=按项目分组"); });
await step("add todo under first project", async () => {
  const card = page.locator("section.card").first();
  await card.locator('input[placeholder="添加待办，回车提交"]').fill(`e2e 待办 ${stamp}`);
  await card.locator('input[placeholder="添加待办，回车提交"]').press("Enter");
  await page.waitForSelector(`text=e2e 待办 ${stamp}`);
});
await step("toggle todo done → moves under 已完成", async () => {
  const li = page.locator("li", { hasText: `e2e 待办 ${stamp}` });
  await li.locator('button[aria-label="toggle"]').click();
  await page.waitForSelector("button:has-text('已完成')");
});
await page.screenshot({ path: `${shots}/todos.png`, fullPage: true });

// ---- Projects ----
await step("open project 1, add task + log", async () => {
  await page.goto(`${base}/projects/1`);
  await page.fill('input[placeholder="新任务，回车提交"]', `e2e 任务 ${stamp}`);
  await page.press('input[placeholder="新任务，回车提交"]', "Enter");
  await page.waitForSelector(`text=e2e 任务 ${stamp}`);
  await page.fill('textarea[name="bodyMd"]', `实验结果 ${stamp}\n\n| lr | acc |\n|---|---|\n| 0.1 | 0.91 |\n\n\`\`\`bash\npython train.py\n\`\`\``);
  await page.click("button:has-text('记一条')");
  await page.waitForSelector(`article:has-text("实验结果 ${stamp}") table`);
});
await step("mark task done → progress bar changes", async () => {
  const progress = page.locator("section.card").first().locator("span.font-mono");
  const before = await progress.innerText();
  await page.locator("li", { hasText: `e2e 任务 ${stamp}` }).locator("button:has-text('完成')").click();
  await page.waitForFunction((prev) => document.querySelector("section.card span.font-mono")?.textContent !== prev, before);
});
await page.screenshot({ path: `${shots}/project.png`, fullPage: true });

// ---- Knowledge base ----
await step("kb list → open first article", async () => {
  await page.goto(`${base}/kb`);
  await page.locator('main a[href^="/kb/"]').first().click();
  await page.waitForSelector("main article h1, main h1");
});
await page.screenshot({ path: `${shots}/kb.png`, fullPage: true });

// ---- Home ----
await step("home renders stats", async () => {
  await page.goto(`${base}/`);
  await page.waitForSelector("text=零散待办");
  await page.waitForSelector("text=本周完成");
});
await page.screenshot({ path: `${shots}/home.png`, fullPage: true });

await browser.close();
if (errors.length) {
  console.log("\nBrowser errors:");
  for (const e of errors) console.log("  " + e);
  process.exit(1);
}
console.log(`\nall steps passed; screenshots in ${shots}/`);
