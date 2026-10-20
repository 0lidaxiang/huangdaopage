import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const site = JSON.parse(readFileSync("content/site.json", "utf8"));
const batch = JSON.parse(
  readFileSync("content/news-batches/2026-10-20.json", "utf8"),
);

test("new brand and recent news are discoverable through the home, signals, search and routes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".brand strong")).toHaveText("荒岛书生");
  await expect(page.locator(".footer-brand")).toContainText("荒岛书生");
  await expect(page).toHaveTitle(/ · 荒岛书生$/);
  await expect(page.locator(".signals-panel h2")).toHaveText("最新信号");
  for (const id of site.settings.signalIds) {
    const record = batch.records.find((item: any) => item.id === id);
    expect(record?.kind).toBe("signal");
    await expect(
      page
        .locator(`.signal-timeline a[href="/signals/${record.slug}"]`)
        .first(),
    ).toBeVisible();
  }

  await page.goto("/signals?sort=time");
  for (const record of batch.records.filter(
    (item: any) => item.kind === "signal",
  )) {
    const item = site.contents.find((item: any) => item.id === record.id);
    await expect(
      page.locator(".article-row").getByRole("link", {
        name: item.title,
        exact: true,
      }),
    ).toHaveAttribute("href", "/signals/" + record.slug);
    expect(item.publishedAt.slice(0, 10)).toBe(record.eventDate);
    expect(record.eventDate >= batch.window.fromDate).toBe(true);
    expect(record.eventDate <= batch.window.toDate).toBe(true);
  }

  await page.goto("/search?q=Qwen-Image-2.1");
  await expect(page.locator(".results-count")).not.toContainText("正在寻找");
  await expect(page.locator(".article-row")).toHaveCount(2);
  const node = batch.records.find(
    (item: any) => item.kind === "node" && item.route === "multimodal",
  );
  await page
    .locator(`.article-row a[href="/evolution/node/${node.slug}"]`)
    .last()
    .click();
  await expect(page.locator(".reading h1")).toContainText("Qwen-Image-2.1");
  await expect(page.locator(".history-facts")).toContainText("2026.09.20");
  await page.reload();
  await expect(
    page.locator('.history-facts a[href="/evolution/multimodal"]'),
  ).toBeVisible();
  await page.goto("/about");
  await expect(page.locator(".markdown")).toContainText("荒岛书生是一个");
});
