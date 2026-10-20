import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] },
});
const { filterContents } = await vite.ssrLoadModule("/src/data.ts");
after(() => vite.close());
const article = (id, title, summary, date, extra = {}) => ({
  id,
  title,
  summary,
  publishedAt: date,
  kind: "depth",
  topics: ["agent"],
  author: "作者",
  source: "来源",
  body: "",
  people: [],
  year: "2026",
  ...extra,
});
const site = {
  topics: [{ slug: "agent", name: "智能体" }],
  contents: [
    article("a", "工程验证", "测试摘要", "2026-10-18T12:00:00+08:00"),
    article("b", "另一篇文章", "工程验证", "2026-10-20T08:00:00+08:00"),
    article("c", "最新", "正文匹配", "2026-10-20T12:00:00+08:00", {
      kind: "signal",
      category: "研究",
      people: ["何恺明"],
    }),
  ],
};
test("full text, title weighting, time sort, Chinese topic and people", () => {
  const bodies = { c: "工程验证" };
  assert.deepEqual(
    filterContents(site, new URLSearchParams({ q: "工程验证" }), bodies).map(
      (i) => i.id,
    ),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    filterContents(
      site,
      new URLSearchParams({ q: "工程验证", sort: "time" }),
      bodies,
    ).map((i) => i.id),
    ["c", "b", "a"],
  );
  assert.equal(
    filterContents(site, new URLSearchParams({ q: "智能体" })).length,
    3,
  );
  assert.equal(
    filterContents(site, new URLSearchParams({ q: "何恺明" }))[0].id,
    "c",
  );
  assert.equal(
    filterContents(
      site,
      new URLSearchParams({ kind: "signal", category: "研究", topic: "agent" }),
    ).length,
    1,
  );
});
test("Shanghai midnight, Monday natural week, natural month", () => {
  const now = new Date("2026-10-19T16:01:00Z"); // Tuesday 00:01 in Shanghai.
  assert.deepEqual(
    filterContents(site, new URLSearchParams({ period: "today" }), {}, now).map(
      (i) => i.id,
    ),
    ["c", "b"],
  );
  assert.deepEqual(
    filterContents(site, new URLSearchParams({ period: "week" }), {}, now).map(
      (i) => i.id,
    ),
    ["c", "b"],
  );
  assert.equal(
    filterContents(site, new URLSearchParams({ period: "month" }), {}, now)
      .length,
    3,
  );
  assert.equal(
    filterContents(site, new URLSearchParams({ q: "没有结果" })).length,
    0,
  );
});
