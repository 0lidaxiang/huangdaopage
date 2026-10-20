import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { applySiteOverrides } from "../scripts/site-settings.mjs";

const site = await applySiteOverrides(
  JSON.parse(readFileSync("content/site.json", "utf8")),
  process.cwd(),
);
const provenance = JSON.parse(readFileSync("content/provenance.json", "utf8"));
const pathFor = (item: any) =>
  item.kind === "node"
    ? `/evolution/node/${item.slug}`
    : `/${item.kind === "signal" ? "signals" : "depth"}/${item.slug}`;
const shots = resolve("artifacts/screenshots");
mkdirSync(shots, { recursive: true });

test("every public HTML contains complete safe Markdown, metadata, valid internal links and local resources without JavaScript", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: "http://127.0.0.1:4180",
  });
  const page = await context.newPage();
  const allPaths = JSON.parse(readFileSync("dist/data/routes.json", "utf8"));
  const known = new Set(allPaths);
  const local = new Set<string>();
  for (const path of allPaths) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    const links = await page
      .locator('a[href^="/"]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")!));
    for (const link of links) {
      const pathname =
        new URL(link, "http://localhost").pathname.replace(/\/$/, "") || "/";
      if (pathname.startsWith("/uploads/")) local.add(pathname);
      else expect(known.has(pathname), `${path} -> ${link}`).toBeTruthy();
    }
    for (const src of await page
      .locator('img[src^="/"],script[src^="/"],link[href^="/"]')
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute("src") || n.getAttribute("href")!),
      ))
      local.add(src);
    const item = site.contents.find((item: any) => pathFor(item) === path);
    if (item) {
      const record = provenance.records.find((row: any) => row.id === item.id);
      const embedded = await page.locator("#page-data").textContent();
      const full = JSON.parse(embedded!).contents.find(
        (row: any) => row.id === item.id,
      );
      expect(createHash("sha256").update(full.body).digest("hex")).toBe(
        record.bodySha256,
      );
      await expect(page.locator(".markdown")).not.toBeEmpty();
      await expect(page).toHaveTitle(
        (item.seoTitle || item.title) + " · " + site.settings.brand,
      );
      expect(
        await page.locator('meta[name="description"]').getAttribute("content"),
      ).toBe(item.seoDescription || item.summary);
      expect(
        await page.locator('script[type="application/ld+json"]').count(),
      ).toBe(1);
      // Every Markdown block is rendered at build time, with no loading placeholder.
      expect(await page.locator(".reading").innerText()).not.toContain(
        "正在加载正文",
      );
    }
  }
  for (const url of local)
    expect((await request.get(url)).status(), url).toBe(200);
  expect((await request.get("/unknown-unpublished-path")).status()).toBe(404);
  expect((await request.get("/api/site")).status()).toBe(404);
  expect((await request.get("/admin")).status()).toBe(404);
  for (const item of site.contents)
    expect((await request.get(pathFor(item) + "/")).status()).toBe(200);
  await context.close();
});

test("all detail pages hydrate, refresh, navigate, and never request the old API", async ({
  page,
}) => {
  const errors: string[] = [],
    forbidden: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    requests.push(url.pathname);
    if (
      url.pathname.startsWith("/api/") ||
      url.port === "8787" ||
      url.port === "8788"
    )
      forbidden.push(request.url());
  });
  for (const item of site.contents) {
    await page.goto(pathFor(item));
    await expect(page.locator(".reading h1")).toHaveText(item.title);
    await expect(page.locator(".markdown")).not.toBeEmpty();
  }
  const detail = site.contents.find((item: any) => item.kind === "depth");
  await page.goto(pathFor(detail));
  await page.reload();
  await expect(page.locator(".reading h1")).toHaveText(detail.title);
  await page.goto("/depth");
  const target = page.locator(".article-row h3").first();
  const heading = await target.innerText();
  await target.click();
  await expect(page.locator(".reading h1")).toHaveText(heading);
  await expect(page.locator(".markdown")).not.toBeEmpty();
  expect(forbidden).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    "artifacts/browser-network.json",
    JSON.stringify(
      { requests: [...new Set(requests)], forbidden, errors },
      null,
      2,
    ),
  );
});

test("full public search, filters, reset, time sorting, topics, evolution and subscription keyboard controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/search");
  await expect(page.locator(".article-row")).toHaveCount(site.contents.length);
  await page.getByLabel("搜索关键词").fill("Transformer");
  await page
    .locator(".search-form")
    .getByRole("button", { name: "搜索", exact: true })
    .click();
  await expect(page.locator(".results-count")).not.toContainText("正在寻找");
  await expect(page.locator(".article-row").first()).toBeVisible();
  await page.getByLabel("内容类型").selectOption("node");
  await expect(page.locator(".article-row").first()).toBeVisible();
  await page.getByLabel("排序方式").selectOption("time");
  await page.getByRole("button", { name: "重置筛选" }).click();
  await expect(page.locator(".article-row")).toHaveCount(site.contents.length);
  await page.getByLabel("搜索关键词").fill("资料来源");
  await page
    .locator(".search-form")
    .getByRole("button", { name: "搜索", exact: true })
    .click();
  const bodyMatches = site.contents.filter((item: any) => {
    const article = JSON.parse(
      readFileSync(`content/articles/${item.kind}/${item.slug}.json`, "utf8"),
    );
    return [
      article.body,
      article.title,
      article.summary,
      article.author,
      article.source,
    ]
      .join(" ")
      .includes("资料来源");
  }).length;
  await expect(page.locator(".article-row")).toHaveCount(bodyMatches);
  await page.getByLabel("排序方式").selectOption("time");
  const dates = await page
    .locator(".article-row time")
    .evaluateAll((nodes) =>
      nodes.map((node) => Date.parse(node.getAttribute("datetime")!)),
    );
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
  await page.getByLabel("搜索关键词").fill("不存在的信号xyz000");
  await page
    .locator(".search-form")
    .getByRole("button", { name: "搜索", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "暂时没有找到相关内容" }),
  ).toBeVisible();
  await page.goto("/signals");
  await expect(page.locator(".article-row")).toHaveCount(
    site.contents.filter((item: any) => item.kind === "signal").length,
  );
  const category = site.contents.find(
    (item: any) => item.kind === "signal",
  ).category;
  await page.getByLabel("信号分类").selectOption(category);
  await expect(page.locator(".article-row")).toHaveCount(
    site.contents.filter(
      (item: any) => item.kind === "signal" && item.category === category,
    ).length,
  );
  await page.getByLabel("时间范围").selectOption("today");
  expect(new URL(page.url()).searchParams.get("category")).toBe(category);
  await page.goto("/topics/" + site.topics[0].slug);
  await expect(page.locator(".article-row")).toHaveCount(site.topics[0].count);
  await page.goto("/evolution");
  await expect(page.locator(".node-card")).toHaveCount(
    site.contents.filter((item: any) => item.kind === "node").length,
  );
  await page.getByLabel("查找历史节点").fill("Transformer");
  await expect(page.locator(".node-card").first()).toBeVisible();
  await page.goto("/");
  const subscribe = page.getByRole("button", { name: /订阅更新/ }).first();
  await subscribe.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  if (!site.settings.qrCode)
    await expect(
      page.getByRole("dialog").getByText("二维码待配置"),
    ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(subscribe).toBeFocused();
  expect(errors).toEqual([]);
});

test("desktop and mobile light/dark visual evidence, theme persistence and mobile menu", async ({
  page,
}) => {
  const pages = [
    "/",
    "/depth",
    "/evolution",
    "/signals",
    pathFor(
      site.contents.find((item: any) => item.id === site.settings.heroId) ||
        site.contents.find((item: any) => item.kind === "depth"),
    ),
  ];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.goto("/");
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: /切换.*主题/ }).click();
      for (const [index, path] of pages.entries()) {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `${width}/${theme}/${path}`,
        ).toBe(true);
        await page.screenshot({
          path: resolve(shots, `${width}-${theme}-${index}.png`),
          fullPage: index < 2,
          animations: "disabled",
        });
      }
    }
  }
  await page.goto("/");
  await page.getByRole("button", { name: "打开菜单" }).click();
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name: "深度", exact: true })
    .click();
  await expect(page.locator("h1")).toContainText("深度解读");
  await expect(page.getByRole("button", { name: "打开菜单" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
