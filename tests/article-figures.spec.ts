import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const articlePath = "/depth/artificial-analysis-index-guide";
const snapshot = JSON.parse(
  readFileSync("content/figures/aa-intelligence-2026-10-20.json", "utf8"),
);

test("article figures remain complete, styled and expandable without JavaScript", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4180" + articlePath);
  await expect(page.locator("h1")).toContainText("10月最新AI榜单");
  await expect(page.locator(".article-figure")).toHaveCount(2);
  await expect(page.locator(".aa-ranking-row")).toHaveCount(32);
  await expect(page.locator(".aa-ranking-row:visible")).toHaveCount(13);
  await expect(page.locator("pre .language-site-chart")).toHaveCount(0);
  await expect(page.locator(".aa-api-note")).toHaveCount(1);
  await expect(page.locator('[data-model="muse-wonder-full"]')).toContainText(
    "无公开 API",
  );
  expect(
    await page
      .locator(".aa-bar")
      .first()
      .evaluate((node) => getComputedStyle(node).display),
  ).toBe("block");
  await page.locator(".aa-more-rows summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".aa-ranking-row:visible")).toHaveCount(32);
  for (const [index, row] of snapshot.rows.entries()) {
    const rendered = page.locator(".aa-ranking-row").nth(index);
    await expect(rendered.locator("strong")).toHaveText(row.name);
    await expect(rendered.locator(".aa-score")).toHaveText(
      String(row.displayScore),
    );
    expect(
      await rendered
        .locator(".aa-bar")
        .evaluate((node) =>
          getComputedStyle(node).getPropertyValue("--aa-entity").trim(),
        ),
    ).toBe(row.color);
  }
  const track = await page.locator(".aa-bar-track").first().boundingBox();
  const bar = await page.locator(".aa-bar").first().boundingBox();
  expect(bar!.width / track!.width).toBeCloseTo(snapshot.rows[0].score / 60, 1);
  const image = await request.get(snapshot.costFigure.url);
  expect(image.status()).toBe(200);
  expect(
    createHash("sha256")
      .update(await image.body())
      .digest("hex"),
  ).toBe(snapshot.inputImages[1].sha256);
  await expect(page.locator(".aa-cost-image")).toHaveAttribute(
    "target",
    "_blank",
  );
  await context.close();
});

test("ranking and source image fit desktop and phones in both themes", async ({
  page,
}) => {
  const output = resolve("artifacts/screenshots/aa-index");
  mkdirSync(output, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.goto(articlePath);
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: /切换.*主题/ }).click();
      const ranking = page.locator(".aa-ranking");
      await ranking.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const selector of [
        ".aa-ranking",
        ".aa-cost",
        ".aa-score",
        ".aa-bar-track",
      ]) {
        for (const box of await page.locator(selector).evaluateAll((nodes) =>
          nodes
            .filter((node) => node.getClientRects().length)
            .map((node) => {
              const rect = node.getBoundingClientRect();
              return { left: rect.left, right: rect.right };
            }),
        )) {
          expect(box.left).toBeGreaterThanOrEqual(0);
          expect(box.right).toBeLessThanOrEqual(width);
        }
      }
      await page.screenshot({
        path: resolve(output, `${width}-${theme}-ranking.png`),
        animations: "disabled",
      });
      await page.locator(".aa-more-rows summary").click();
      await expect(page.locator(".aa-ranking-row:visible")).toHaveCount(32);
      await page.locator(".aa-cost").scrollIntoViewIfNeeded();
      await expect(page.locator(".aa-cost-image img")).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator(".aa-cost-image img")
            .evaluate(
              (node: HTMLImageElement) =>
                node.complete && node.naturalWidth === 2388,
            ),
        )
        .toBe(true);
      await page.screenshot({
        path: resolve(output, `${width}-${theme}-cost.png`),
        animations: "disabled",
      });
    }
  }
  expect(errors).toEqual([]);
});
