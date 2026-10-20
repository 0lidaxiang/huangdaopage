import type { Content, Site } from "./types";

export const basePath = import.meta.env.BASE_URL;
export const assetUrl = (path: string) =>
  path.startsWith("/") && !path.startsWith("//")
    ? basePath + path.slice(1)
    : path;

async function read<T>(path: string): Promise<T> {
  const response = await fetch(assetUrl("/data/" + path));
  if (!response.ok) throw new Error("静态内容加载失败，请刷新后重试。");
  return response.json();
}

let sitePromise: Promise<Site> | undefined;
const articles = new Map<string, Promise<Content>>();
let searchPromise: Promise<Record<string, string>> | undefined;
export const loadSite = () => (sitePromise ??= read<Site>("site.json"));
export const loadArticle = (item: Content) => {
  if (item.body) return Promise.resolve(item);
  const key = `${item.kind}/${item.slug}`;
  if (!articles.has(key)) {
    articles.set(
      key,
      read<Content>(`articles/${key}.json`).catch((error) => {
        articles.delete(key);
        throw error;
      }),
    );
  }
  return articles.get(key)!;
};
export const loadSearch = () =>
  (searchPromise ??= read<Record<string, string>>("search-index.json").catch(
    (error) => {
      searchPromise = undefined;
      throw error;
    },
  ));

export function filterContents(
  site: Site,
  params: URLSearchParams,
  bodies: Record<string, string> = {},
  now = new Date(),
) {
  const q = (params.get("q") || "").trim().toLowerCase();
  // Shanghai calendar periods: midnight UTC+08, Monday starts the natural week.
  const shanghai = new Date(now.getTime() + 8 * 3600_000);
  let start =
    Date.UTC(
      shanghai.getUTCFullYear(),
      shanghai.getUTCMonth(),
      shanghai.getUTCDate(),
    ) -
    8 * 3600_000;
  if (params.get("period") === "week")
    start -= ((shanghai.getUTCDay() + 6) % 7) * 86400_000;
  if (params.get("period") === "month")
    start =
      Date.UTC(shanghai.getUTCFullYear(), shanghai.getUTCMonth(), 1) -
      8 * 3600_000;
  const matches = site.contents.filter((item) => {
    if (params.get("kind") && item.kind !== params.get("kind")) return false;
    if (params.get("category") && item.category !== params.get("category"))
      return false;
    if (params.get("topic") && !item.topics.includes(params.get("topic")!))
      return false;
    if (params.get("period") && Date.parse(item.publishedAt) < start)
      return false;
    const hay = [
      item.title,
      item.summary,
      bodies[item.id] || item.body,
      item.author,
      item.source,
      ...item.topics,
      ...(item.people || []),
      item.year,
      ...site.topics
        .filter((t) => item.topics.includes(t.slug))
        .map((t) => t.name),
    ]
      .join(" ")
      .toLowerCase();
    return !q || hay.includes(q);
  });
  const score = (item: Content) =>
    q
      ? (item.title.toLowerCase().includes(q) ? 10 : 0) +
        (item.summary.toLowerCase().includes(q) ? 3 : 0)
      : 0;
  return matches.sort(
    (a, b) =>
      (params.get("sort") !== "time" ? score(b) - score(a) : 0) ||
      Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
}
