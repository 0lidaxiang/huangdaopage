import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { applySiteOverrides } from "../scripts/site-settings.mjs";

const site = await applySiteOverrides(
  JSON.parse(readFileSync("content/site.json", "utf8")),
  process.cwd(),
);
mkdirSync("artifacts/subscriptions", { recursive: true });

test("both real QR assets are served locally and subscription links match their payloads", async ({
  page,
  request,
}) => {
  const externalImages: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "image" &&
      new URL(request.url()).origin !== "http://127.0.0.1:4180"
    )
      externalImages.push(request.url());
  });
  await page.goto("/");
  const card = page.locator(".subscribe-card");
  await expect(
    card.getByRole("img", { name: "微信公众号二维码", exact: true }),
  ).toHaveAttribute("src", site.settings.qrCode);
  await expect(
    card.getByRole("img", { name: "小红书二维码", exact: true }),
  ).toHaveAttribute("src", site.settings.xiaohongshuQrCode);
  for (const path of [site.settings.qrCode, site.settings.xiaohongshuQrCode])
    expect((await request.get(path)).status()).toBe(200);
  const enlarge = card.getByRole("button", {
    name: "放大小红书二维码",
    exact: true,
  });
  await enlarge.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("link", { name: "打开公众号（新标签页）" }),
  ).toHaveAttribute("href", site.settings.wechatUrl);
  await expect(
    dialog.getByRole("link", { name: "打开小红书（新标签页）" }),
  ).toHaveAttribute("href", "https://xhslink.com/m/7mMhFIxAvCX");
  await expect(
    dialog.getByRole("link", { name: "打开小红书（新标签页）" }),
  ).toHaveAttribute("target", "_blank");
  await expect(dialog.locator("img")).toHaveCount(2);
  await expect
    .poll(() =>
      dialog
        .locator("img")
        .evaluateAll((nodes) =>
          nodes.every(
            (node) =>
              node instanceof HTMLImageElement &&
              node.complete &&
              node.naturalWidth === 430,
          ),
        ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(enlarge).toBeFocused();
  expect(externalImages).toEqual([]);
});

test("two-channel subscription remains usable on desktop and phones in both themes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.goto("/");
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: /切换.*主题/ }).click();
      await page.locator(".subscribe-card").scrollIntoViewIfNeeded();
      await page.locator(".subscribe-card").screenshot({
        path: `artifacts/subscriptions/card-${width}-${theme}.png`,
      });
      await page
        .locator(".subscribe-card")
        .getByRole("button", { name: "放大二维码", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect(
        await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await dialog
        .getByRole("link", { name: "打开小红书（新标签页）" })
        .scrollIntoViewIfNeeded();
      await expect(
        dialog.getByRole("link", { name: "打开小红书（新标签页）" }),
      ).toBeVisible();
      await page.screenshot({
        path: `artifacts/subscriptions/modal-${width}-${theme}.png`,
      });
      await page.keyboard.press("Escape");
    }
  }
  expect(errors).toEqual([]);
});
