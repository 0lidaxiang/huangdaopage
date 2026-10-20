import type { Site } from "./types";
import { linkTo } from "./types";

export function pageInfo(path: string, site: Site) {
  path = path.replace(/\/$/, "") || "/";
  const item = site.contents.find((entry) => linkTo(entry) === path);
  const topic = site.topics.find((entry) => "/topics/" + entry.slug === path);
  const route = site.routes.find(
    (entry) => "/evolution/" + entry.slug === path,
  );
  const names: Record<string, string> = {
    "/": "看清 AI 变化，做出更好的判断",
    "/signals": "信号",
    "/depth": "深度解读",
    "/evolution": "AI 演化地图",
    "/topics": "热门话题",
    "/search": "搜索荒岛",
    "/about": "关于我们",
    "/consulting": "咨询",
  };
  const name =
    item?.seoTitle || item?.title || topic?.name || route?.name || names[path];
  return {
    title: (name || "这片海域还没有信号") + " · " + site.settings.brand,
    description:
      item?.seoDescription ||
      item?.summary ||
      topic?.description ||
      route?.description ||
      site.settings.seoDescription,
    item,
    notFound: !name,
  };
}
