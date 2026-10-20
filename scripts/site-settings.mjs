import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Local public subscription settings survive a fresh database content export.
export async function applySiteOverrides(site, root) {
  let overrides;
  try {
    overrides = JSON.parse(
      await readFile(resolve(root, "content/site-overrides.json"), "utf8"),
    );
  } catch (error) {
    if (error.code === "ENOENT") return site;
    throw error;
  }
  const allowed = new Set([
    "wechatName",
    "qrCode",
    "wechatUrl",
    "xiaohongshuUrl",
    "xiaohongshuQrCode",
  ]);
  if (
    !overrides ||
    Object.keys(overrides).some((key) => key !== "settings") ||
    !overrides.settings ||
    typeof overrides.settings !== "object" ||
    Array.isArray(overrides.settings)
  )
    throw new Error("站点订阅覆盖配置格式无效");
  for (const [key, value] of Object.entries(overrides.settings)) {
    if (!allowed.has(key) || typeof value !== "string")
      throw new Error("不支持的订阅配置字段：" + key);
    if (value && key.endsWith("Url")) {
      const url = new URL(value);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("订阅链接必须是 HTTP(S) 公开地址");
    }
    if (
      value &&
      ["qrCode", "xiaohongshuQrCode"].includes(key) &&
      !/^\/uploads\/[^?#]+\.(webp|png|jpe?g)$/i.test(value)
    )
      throw new Error("订阅二维码应使用 public/uploads/ 下的本地图片");
  }
  return { ...site, settings: { ...site.settings, ...overrides.settings } };
}
