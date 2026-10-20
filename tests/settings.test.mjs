import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { applySiteOverrides } from "../scripts/site-settings.mjs";

test("public subscription overrides remain independent of a database snapshot", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "huangdao-subscriptions-"));
  try {
    const site = {
      contents: [{ id: "public-one" }],
      settings: { wechatName: "测试公众号", qrCode: "" },
    };
    assert.equal(await applySiteOverrides(site, root), site);
    await mkdir(resolve(root, "content"));
    await writeFile(
      resolve(root, "content/site-overrides.json"),
      JSON.stringify({
        settings: {
          qrCode: "/uploads/subscriptions/wechat.webp",
          xiaohongshuUrl: "https://xhslink.com/m/example",
          xiaohongshuQrCode: "/uploads/subscriptions/xhs.png",
        },
      }),
    );
    const result = await applySiteOverrides(site, root);
    assert.equal(site.settings.qrCode, "");
    assert.equal(result.settings.qrCode, "/uploads/subscriptions/wechat.webp");
    assert.equal(result.settings.wechatName, "测试公众号");
    assert.equal(result.contents, site.contents);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("subscription overrides cannot introduce private fields, records or executable links", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "huangdao-subscriptions-"));
  try {
    await mkdir(resolve(root, "content"));
    for (const value of [
      { settings: { adminKey: "not-public" } },
      { settings: {}, contents: [{ id: "draft" }] },
      { settings: { xiaohongshuUrl: "javascript:alert(1)" } },
      { settings: { qrCode: "https://example.com/qr.png" } },
    ]) {
      await writeFile(
        resolve(root, "content/site-overrides.json"),
        JSON.stringify(value),
      );
      await assert.rejects(applySiteOverrides({ settings: {} }, root));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
