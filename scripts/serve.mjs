// Static files only. No API, database, reverse proxy, SSR, or SPA fallback.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const port = Number(process.env.PORT || 4180);
let base = process.env.SITE_BASE_PATH;
if (!base) {
  try {
    base = JSON.parse(
      await readFile(resolve(root, "../artifacts/build-summary.json"), "utf8"),
    ).base;
  } catch {
    base = "/";
  }
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
};
http
  .createServer(async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405).end();
        return;
      }
      let path;
      try {
        path = decodeURIComponent(
          new URL(req.url, "http://localhost").pathname,
        );
      } catch {
        res.writeHead(400).end();
        return;
      }
      const mount = base === "/" ? "" : base.slice(0, -1);
      if (path === mount && mount) {
        res.writeHead(308, { Location: base }).end();
        return;
      }
      if (mount && !path.startsWith(base)) {
        res.writeHead(404).end("Not found");
        return;
      }
      path = path.slice(mount.length);
      if (
        path.includes("\0") ||
        path.split("/").some((part) => part.startsWith("."))
      ) {
        res.writeHead(404).end();
        return;
      }
      let target = resolve(root, "." + path),
        code = 200;
      if (target !== root && !target.startsWith(root + "/")) {
        res.writeHead(404).end();
        return;
      }
      try {
        if ((await stat(target)).isDirectory())
          target = resolve(target, "index.html");
        await stat(target);
      } catch {
        target = resolve(root, "404.html");
        code = 404;
      }
      const content = await readFile(target);
      res.writeHead(code, {
        "Content-Type": mime[extname(target)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      res.writeHead(500).end("Build dist/ first.");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Static preview: http://127.0.0.1:${port}${base}`),
  );
