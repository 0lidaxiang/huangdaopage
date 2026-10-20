import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const origin = process.env.PREVIEW_ORIGIN || "http://127.0.0.1:4181";
const base = process.env.SITE_BASE_PATH || "/huangdaopage/";
const site = JSON.parse(await readFile("content/site.json", "utf8"));
const routes = JSON.parse(await readFile("dist/data/routes.json", "utf8"));
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage();
const errors = [],
  badRequests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("response", (response) => {
  if (response.status() >= 400)
    badRequests.push({ url: response.url(), status: response.status() });
});
page.on("request", (request) => {
  const url = new URL(request.url());
  if (url.origin === origin && !url.pathname.startsWith(base))
    badRequests.push({ url: request.url(), reason: "missing-prefix" });
});
try {
  for (const path of routes) {
    const response = await page.goto(origin + base + path.replace(/^\//, ""));
    if (response.status() !== 200 || (await page.locator("h1").count()) !== 1)
      throw new Error("子路径加载失败：" + path);
    await page.getByRole("button", { name: /切换.*主题/ }).waitFor();
  }
  await page.reload();
  await page.goto(origin + base + "search?q=Transformer");
  await page.locator(".results-count").filter({ hasText: /找到/ }).waitFor();
  if (!(await page.locator(".article-row").count()))
    throw new Error("子路径搜索失败");
  const target = page.locator(".article-row h3").first();
  const title = await target.innerText();
  await target.click();
  await page.locator(".markdown").waitFor();
  if ((await page.locator(".reading h1").innerText()) !== title)
    throw new Error("子路径站内导航失败");
  if (!page.url().startsWith(origin + base)) throw new Error("导航丢失前缀");
  if (errors.length || badRequests.length)
    throw new Error(JSON.stringify({ errors, badRequests }));
  await writeFile(
    "artifacts/subpath-verification.json",
    JSON.stringify(
      {
        base,
        routes: routes.length,
        publicTotal: site.contents.length,
        errors,
        badRequests,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    `子路径 ${base}：${routes.length} 个路径、刷新、搜索、站内导航和资源加载通过。`,
  );
} finally {
  await browser.close();
}
