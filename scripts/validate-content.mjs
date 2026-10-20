import { readFile, access, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hash = (value) => createHash("sha256").update(value).digest("hex");
export const contentPath = (item) =>
  item.kind === "node"
    ? `/evolution/node/${item.slug}`
    : `/${item.kind === "signal" ? "signals" : "depth"}/${item.slug}`;
export async function validateContent() {
  let site, provenance;
  try {
    site = JSON.parse(
      await readFile(resolve(root, "content/site.json"), "utf8"),
    );
    provenance = JSON.parse(
      await readFile(resolve(root, "content/provenance.json"), "utf8"),
    );
  } catch {
    throw new Error(
      "缺少公开内容源。先运行 npm run content:export；构建不会读取数据库或使用 seed。",
    );
  }
  const errors = [],
    ids = new Set(),
    paths = new Set();
  const allowedFields = new Set(
    "id kind slug title summary body category topics author source sourceUrl cover status publishedAt updatedAt readMinutes featured seoTitle seoDescription route stage year people order related revision".split(
      " ",
    ),
  );
  if ((site.media || []).length) errors.push("公开索引不应包含原始媒体库");
  const topics = new Set(site.topics.map((t) => t.slug));
  const routes = new Set(site.routes.map((r) => r.slug));
  const stages = new Set(site.stages.map((s) => s.name));
  const at = Date.parse(provenance.visibilityAsOf || provenance.exportedAt);
  const manifest = new Map(provenance.records.map((item) => [item.id, item]));
  const details = [];
  for (const item of site.contents) {
    if (
      !["signal", "depth", "node"].includes(item.kind) ||
      !/^[a-z0-9][a-z0-9-]{0,100}$/.test(item.slug)
    )
      errors.push("无效类型或 slug：" + item.id);
    if (Object.keys(item).some((key) => !allowedFields.has(key)))
      errors.push("公开索引包含模型之外的字段：" + item.id);
    if (ids.has(item.id) || paths.has(contentPath(item)))
      errors.push("重复 ID/路径：" + item.id);
    ids.add(item.id);
    paths.add(contentPath(item));
    if (
      item.status !== "published" ||
      !Number.isFinite(Date.parse(item.publishedAt)) ||
      Date.parse(item.publishedAt) > at
    )
      errors.push("非公开记录：" + item.id);
    if (item.body) errors.push("元数据中不应包含正文：" + item.id);
    for (const slug of item.topics)
      if (!topics.has(slug)) errors.push("话题缺失：" + item.id + "/" + slug);
    if (
      item.kind === "node" &&
      (!routes.has(item.route) || !stages.has(item.stage))
    )
      errors.push("路线或阶段缺失：" + item.id);
    const full = JSON.parse(
      await readFile(
        resolve(root, "content/articles", item.kind, item.slug + ".json"),
        "utf8",
      ),
    );
    if (Object.keys(full).some((key) => !allowedFields.has(key)))
      errors.push("正文记录包含模型之外的字段：" + item.id);
    details.push(full);
    if (
      full.id !== item.id ||
      full.slug !== item.slug ||
      full.kind !== item.kind ||
      full.status !== "published"
    )
      errors.push("文章与索引不一致：" + item.id);
    if (!full.body || hash(full.body) !== manifest.get(item.id)?.bodySha256)
      errors.push("正文校验不一致：" + item.id);
    for (const key of Object.keys(item).filter((key) => key !== "body"))
      if (JSON.stringify(item[key]) !== JSON.stringify(full[key]))
        errors.push("元数据不一致：" + item.id + "/" + key);
  }
  if (
    ids.size !== provenance.publicTotal ||
    ids.size !== manifest.size ||
    [...manifest.keys()].some((key) => !ids.has(key))
  )
    errors.push("公开 ID 清单无法对账");
  const actualFiles = [];
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(resolve(path, entry.name));
      else actualFiles.push(resolve(path, entry.name));
    }
  }
  await walk(resolve(root, "content/articles"));
  if (actualFiles.length !== ids.size)
    errors.push("文章目录存在遗漏或额外文件");
  for (const topic of site.topics)
    if (
      topic.count !==
      site.contents.filter((item) => item.topics.includes(topic.slug)).length
    )
      errors.push("话题计数不符：" + topic.slug);
  for (const item of details)
    for (const related of item.related || [])
      if (!ids.has(related)) errors.push("关联非公开 ID：" + item.id);
  for (const key of ["signalIds", "featuredIds", "sidebarIds"])
    for (const id of site.settings[key] || [])
      if (!ids.has(id)) errors.push("推荐非公开 ID：" + key);
  if (site.settings.heroId && !ids.has(site.settings.heroId))
    errors.push("主推内容不公开");
  // Includes Markdown inline/reference URLs, cover/topic/QR resources and settings prose.
  const text = JSON.stringify([details, site.topics, site.settings]);
  const local = new Set(
    [...text.matchAll(/\/(?:uploads|design)\/[^\s"<>\\)\]]+/g)].map(
      (match) => match[0],
    ),
  );
  for (const url of local) {
    const path = resolve(
      root,
      "public",
      decodeURIComponent(url.split(/[?#]/)[0]).replace(/^\//, ""),
    );
    if (
      !["uploads", "design"].some((prefix) =>
        path.startsWith(resolve(root, "public", prefix) + "/"),
      )
    )
      errors.push("媒体越界");
    try {
      await access(path);
    } catch {
      errors.push("本地媒体缺失：" + url);
    }
  }
  if (
    /https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/])|["(]\/(?:api|admin)(?:\/|["?)])/i.test(
      text,
    )
  )
    errors.push("公开内容仍引用本地服务或后台");
  if (errors.length) throw new Error(errors.join("\n"));
  return { site, provenance, details };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { site, provenance } = await validateContent();
  console.log(
    `公开 ${site.contents.length} 条；完整清单/正文哈希、话题、路线、阶段、推荐与本地媒体检查通过（盘点 ${provenance.inventoryTotal} 条）。`,
  );
}
