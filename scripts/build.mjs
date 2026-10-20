import { build } from "vite";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareContent, root } from "./prepare-content.mjs";
import { contentPath } from "./validate-content.mjs";

const { site, provenance } = await prepareContent();
const base = process.env.SITE_BASE_PATH || "/";
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))
  throw new Error("SITE_BASE_PATH 必须为 / 或 /目录/，并以 / 结束");
const origin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : "";
if (origin && !origin.startsWith("https://"))
  throw new Error("SITE_URL 请使用正式 HTTPS 域名");
await build();
await build({
  build: {
    ssr: "src/entry-server.tsx",
    outDir: ".ssr",
    emptyOutDir: true,
    copyPublicDir: false,
  },
});
const { render, pageInfo } = await import(
  pathToFileURL(resolve(root, ".ssr/entry-server.js"))
);
const template = await readFile(resolve(root, "dist/index.html"), "utf8");
const esc = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const json = (s) =>
  JSON.stringify(s)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
const routes = [
  "/",
  "/signals",
  "/depth",
  "/evolution",
  "/topics",
  "/search",
  "/about",
  "/consulting",
  ...site.routes.map((r) => "/evolution/" + r.slug),
  ...site.topics.map((t) => "/topics/" + t.slug),
  ...site.contents.map(contentPath),
];
async function page(path, notFound = false) {
  const { item, title, description } = pageInfo(path, site);
  let current = site;
  if (item) {
    const full = JSON.parse(
      await readFile(
        resolve(root, "content/articles", item.kind, item.slug + ".json"),
        "utf8",
      ),
    );
    current = {
      ...site,
      contents: site.contents.map((entry) =>
        entry.id === full.id ? full : entry,
      ),
    };
  }
  const canonical = origin ? origin + base + path.replace(/^\//, "") : "";
  const structured = item
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: item.title,
        description,
        datePublished: item.publishedAt,
        dateModified: item.updatedAt || item.publishedAt,
        author: { "@type": "Person", name: item.author },
        ...(canonical ? { mainEntityOfPage: canonical } : {}),
        ...(item.sourceUrl ? { citation: item.sourceUrl } : {}),
      }
    : null;
  const head = `<meta name="robots" content="${notFound || path === "/search" ? "noindex,follow" : "index,follow"}">\n<meta property="og:type" content="${item ? "article" : "website"}">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(description)}">\n${canonical ? `<link rel="canonical" href="${esc(canonical)}"><meta property="og:url" content="${esc(canonical)}">` : ""}\n${structured ? `<script type="application/ld+json">${json(structured)}</script>` : ""}`;
  return template
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${esc(description)}">`,
    )
    .replace(
      'data-theme="light"',
      `data-theme="${site.settings.defaultTheme === "dark" ? "dark" : "light"}"`,
    )
    .replace("<!--head-->", () => head)
    .replace("<!--app-->", () => render(path, current))
    .replace(
      "<!--data-->",
      () =>
        `<script type="application/json" id="page-data"${notFound ? ' data-not-found="true"' : ""}>${json(current)}</script>`,
    );
}
for (const path of routes) {
  const dir = resolve(root, "dist", path.replace(/^\//, ""));
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "index.html"), await page(path));
}
await writeFile(
  resolve(root, "dist/404.html"),
  await page("/__not_found__", true),
);
const canonicalPaths = routes.filter((p) => p !== "/search");
await writeFile(
  resolve(root, "dist/sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${origin ? canonicalPaths.map((p) => `<url><loc>${esc(origin + base + p.replace(/^\//, ""))}</loc></url>`).join("") : ""}</urlset>`,
);
await writeFile(
  resolve(root, "dist/robots.txt"),
  `User-agent: *\nAllow: ${base}\nDisallow: ${base}search\n${origin ? "Sitemap: " + origin + base + "sitemap.xml\n" : ""}`,
);
await writeFile(resolve(root, "dist/data/routes.json"), JSON.stringify(routes));
// SSG exact/dynamic rewrites map public URLs to real files; there is no SPA catch-all.
const config = JSON.parse(
  await readFile(resolve(root, "edgeone.json"), "utf8"),
);
if (base !== "/") {
  for (const rule of [...config.rewrites, ...config.headers]) {
    rule.source = base.slice(0, -1) + rule.source;
    if (rule.destination)
      rule.destination = base.slice(0, -1) + rule.destination;
  }
  // Dist can be mounted at a prefix on another static host. EdgeOne deploys at root by default.
}
await writeFile(
  resolve(root, "dist/edgeone.json"),
  JSON.stringify(
    { rewrites: config.rewrites, headers: config.headers },
    null,
    2,
  ) + "\n",
);
await writeFile(
  resolve(root, "artifacts/build-summary.json"),
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      base,
      origin: origin || null,
      routes: routes.length,
      publicTotal: site.contents.length,
      sourceSnapshotSha256: provenance.snapshotSha256,
    },
    null,
    2,
  ),
).catch(async (error) => {
  if (error.code !== "ENOENT") throw error;
  await mkdir(resolve(root, "artifacts"), { recursive: true });
  await writeFile(
    resolve(root, "artifacts/build-summary.json"),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        base,
        origin: origin || null,
        routes: routes.length,
        publicTotal: site.contents.length,
        sourceSnapshotSha256: provenance.snapshotSha256,
      },
      null,
      2,
    ),
  );
});
await rm(resolve(root, ".ssr"), { recursive: true, force: true });
console.log(
  `SSG: ${routes.length} 个公开页面 + 404；${site.contents.length} 篇完整正文；输出 dist/。${origin ? "" : "尚未配置 SITE_URL，暂不生成 canonical 和 sitemap 域名。"}`,
);
