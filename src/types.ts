export type Kind = "signal" | "depth" | "node";
export type Content = {
  id: string;
  kind: Kind;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  topics: string[];
  author: string;
  source: string;
  sourceUrl: string;
  cover: string;
  status: string;
  publishedAt: string;
  updatedAt: string;
  readMinutes: number;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  route: string;
  stage: string;
  year: string;
  people?: string[];
  order: number;
  related: string[];
  revision: number;
};
export type Topic = {
  slug: string;
  name: string;
  description: string;
  cover: string;
  heat: string;
  count: number;
};
export type EvolutionRoute = {
  slug: string;
  name: string;
  description: string;
  steps: string[];
};
export type Settings = {
  brand: string;
  tagline: string;
  wechatName: string;
  qrCode: string;
  about: string;
  consulting: string;
  contact: string;
  defaultTheme: string;
  seoDescription: string;
  navigation: string[];
  heroId: string;
  signalIds: string[];
  featuredIds: string[];
  sidebarIds: string[];
};
export type Media = {
  id: string;
  name: string;
  url: string;
  alt: string;
  size: number;
  createdAt: string;
  archived: boolean;
};
export type Site = {
  contents: Content[];
  topics: Topic[];
  routes: EvolutionRoute[];
  stages: { name: string; period: string; description: string }[];
  settings: Settings;
  media: Media[];
};
export const linkTo = (c: Content) =>
  c.kind === "node"
    ? `/evolution/node/${c.slug}`
    : `/${c.kind === "signal" ? "signals" : "depth"}/${c.slug}`;
export const labels: Record<string, string> = {
  signal: "信号",
  depth: "深度",
  node: "演化节点",
  draft: "草稿",
  scheduled: "定时发布",
  published: "已发布",
  offline: "已下线",
  trash: "回收站",
};
export const date = (v: string) =>
  v
    ? new Date(v).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Shanghai",
      })
    : "未设置";
