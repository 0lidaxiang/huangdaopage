// Explicitly accept local public-content edits; never reads MySQL or the source repo.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { root } from "./prepare-content.mjs";
const site = JSON.parse(
  await readFile(resolve(root, "content/site.json"), "utf8"),
);
const provenance = JSON.parse(
  await readFile(resolve(root, "content/provenance.json"), "utf8"),
);
const originalIds =
  provenance.maintenance?.baselinePublicIds ||
  provenance.records.map((item) => item.id);
const contents = [],
  ids = new Set(),
  paths = new Set();
for (const kind of ["signal", "depth", "node"]) {
  let files = [];
  try {
    files = await readdir(resolve(root, "content/articles", kind));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const item = JSON.parse(
      await readFile(resolve(root, "content/articles", kind, file), "utf8"),
    );
    if (
      item.kind !== kind ||
      item.slug + ".json" !== file ||
      !/^[a-z0-9][a-z0-9-]{0,100}$/.test(item.slug) ||
      ids.has(item.id) ||
      paths.has(`${kind}/${item.slug}`)
    )
      throw new Error("内容类型、ID 或路径不合法：" + file);
    if (
      item.status !== "published" ||
      !Number.isFinite(Date.parse(item.publishedAt)) ||
      Date.parse(item.publishedAt) > Date.now()
    )
      throw new Error(
        "仅接受当前已发布内容。草稿/未来内容请放在 .private/：" + file,
      );
    for (const key of [
      "id",
      "title",
      "summary",
      "body",
      "seoTitle",
      "seoDescription",
    ])
      if (!item[key]) throw new Error("缺少字段 " + key + "：" + file);
    ids.add(item.id);
    paths.add(`${kind}/${item.slug}`);
    contents.push(item);
  }
}
const previous = new Map(site.contents.map((item, index) => [item.id, index]));
contents.sort(
  (a, b) =>
    (previous.get(a.id) ?? 1e9) - (previous.get(b.id) ?? 1e9) ||
    Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
);
for (const item of contents)
  for (const id of item.related || [])
    if (!ids.has(id))
      throw new Error("先修复失效关联：" + item.id + " -> " + id);
site.contents = contents.map((item) => ({ ...item, body: "" }));
for (const topic of site.topics)
  topic.count = contents.filter((item) =>
    item.topics.includes(topic.slug),
  ).length;
for (const key of ["signalIds", "featuredIds", "sidebarIds"])
  site.settings[key] = site.settings[key].filter((id) => ids.has(id));
if (!ids.has(site.settings.heroId)) site.settings.heroId = "";
const hash = (text) => createHash("sha256").update(text).digest("hex");
const ordered = (value) =>
  Array.isArray(value)
    ? value.map(ordered)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, ordered(value[key])]),
        )
      : value;
provenance.records = contents.map((item) => ({
  id: item.id,
  kind: item.kind,
  slug: item.slug,
  bodySha256: hash(item.body),
  bodyCharacters: [...item.body].length,
  recordSha256: hash(JSON.stringify(ordered(item))),
}));
provenance.publicTotal = contents.length;
provenance.publicKinds = Object.fromEntries(
  ["signal", "depth", "node"].map((kind) => [
    kind,
    contents.filter((item) => item.kind === kind).length,
  ]),
);
provenance.visibilityAsOf = new Date().toISOString();
provenance.maintenance = {
  updatedAt: provenance.visibilityAsOf,
  baselinePublicIds: originalIds,
  addedIds: [...ids].filter((id) => !originalIds.includes(id)),
  removedIds: originalIds.filter((id) => !ids.has(id)),
  method:
    "Explicit local public-content edit; original export provenance preserved.",
};
await writeFile(
  resolve(root, "content/site.json"),
  JSON.stringify(site, null, 2) + "\n",
);
await writeFile(
  resolve(root, "content/provenance.json"),
  JSON.stringify(provenance, null, 2) + "\n",
);
console.log(
  `已同步 ${contents.length} 条公开内容；请运行 npm run content:check 和 npm run build 检查引用与渲染。`,
);
