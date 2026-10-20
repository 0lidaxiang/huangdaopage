import { useCallback, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Search,
  Sun,
  Moon,
  Menu,
  X,
  ArrowRight,
  ArrowUpRight,
  Radio,
  Network,
  Code2,
  Layers,
  Sparkles,
  Bot,
  BookOpen,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Content, Site, linkTo, labels, date } from "./types";
import {
  assetUrl,
  basePath,
  filterContents,
  loadArticle,
  loadSearch,
} from "./data";
import { pageInfo } from "./seo";
import {
  BrandMark,
  Artwork,
  Thumb,
  SectionTitle,
  Tags,
  Meta,
  ArticleRow,
  SubscribeCard,
  SubscriptionCodes,
  Sidebar,
  Markdown,
  Modal,
  Empty,
} from "./components";
const navNames: Record<string, string> = {
  signals: "信号",
  depth: "深度",
  evolution: "演化",
  about: "关于我们",
  topics: "热门话题",
  consulting: "咨询",
};
export default function App({ initialSite }: { initialSite: Site }) {
  const site = initialSite;
  const [subscribe, setSubscribe] = useState(false);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(site.settings.defaultTheme || "light");
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    try {
      const saved = localStorage.getItem("huangdao-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* The default theme works with storage disabled. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const info = pageInfo(location.pathname, site);
    document.title = info.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", info.description);
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", info.title);
    document
      .querySelector('meta[property="og:description"]')
      ?.setAttribute("content", info.description);
    document
      .querySelector('meta[property="og:type"]')
      ?.setAttribute("content", info.item ? "article" : "website");
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (canonical) {
      const href = new URL(canonical.href);
      href.pathname =
        basePath + location.pathname.replace(/^\//, "").replace(/\/$/, "");
      canonical.href = href.href;
      document
        .querySelector('meta[property="og:url"]')
        ?.setAttribute("content", href.href);
    }
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute(
        "content",
        info.notFound || location.pathname === "/search"
          ? "noindex,follow"
          : "index,follow",
      );
    let structured = document.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    );
    if (info.item) {
      if (!structured) {
        structured = document.createElement("script");
        structured.type = "application/ld+json";
        document.head.append(structured);
      }
      structured.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: info.item.title,
        description: info.description,
        datePublished: info.item.publishedAt,
        dateModified: info.item.updatedAt || info.item.publishedAt,
        author: { "@type": "Person", name: info.item.author },
        ...(canonical ? { mainEntityOfPage: canonical.href } : {}),
        ...(info.item.sourceUrl ? { citation: info.item.sourceUrl } : {}),
      });
    } else structured?.remove();
  }, [location.pathname, site]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        navigate("/search");
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [navigate]);
  const close = useCallback(() => setSubscribe(false), []);
  const sub = () => setSubscribe(true);
  return (
    <>
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <BrandMark />
            <div>
              <strong>
                {site.settings.brand}
                <Radio size={20} />
              </strong>
              <small>{site.settings.tagline}</small>
            </div>
          </Link>
          <nav
            id="main-navigation"
            className={menu ? "nav open" : "nav"}
            aria-label="主导航"
          >
            <NavLink to="/" end>
              首页
            </NavLink>
            {site.settings.navigation.map((n) => (
              <NavLink to={"/" + n} key={n}>
                {navNames[n]}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="search-trigger"
              onClick={() => navigate("/search")}
              aria-label="搜索"
            >
              <Search size={17} />
              <span>搜索新闻、观点、公司…</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button"
              onClick={() => {
                const t = theme === "light" ? "dark" : "light";
                setTheme(t);
                try {
                  localStorage.setItem("huangdao-theme", t);
                } catch {
                  /* Optional persistence. */
                }
              }}
              aria-label={theme === "light" ? "切换暗黑主题" : "切换亮色主题"}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="button small-button subscribe-top" onClick={sub}>
              订阅更新 <Radio size={14} />
            </button>
            <button
              className="icon-button menu-button"
              aria-label={menu ? "关闭菜单" : "打开菜单"}
              aria-expanded={menu}
              aria-controls="main-navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="container">
        <Routes>
          <Route path="/" element={<Home site={site} sub={sub} />} />
          <Route
            path="/signals"
            element={<Listing site={site} sub={sub} kind="signal" />}
          />
          <Route path="/depth" element={<Depth site={site} sub={sub} />} />
          <Route
            path="/signals/:slug"
            element={<Detail site={site} sub={sub} kind="signal" />}
          />
          <Route
            path="/depth/:slug"
            element={<Detail site={site} sub={sub} kind="depth" />}
          />
          <Route
            path="/evolution"
            element={<Evolution site={site} sub={sub} />}
          />
          <Route
            path="/evolution/node/:slug"
            element={<Detail site={site} sub={sub} kind="node" />}
          />
          <Route
            path="/evolution/:route"
            element={<Evolution site={site} sub={sub} />}
          />
          <Route path="/topics" element={<Topics site={site} />} />
          <Route
            path="/topics/:slug"
            element={<Listing site={site} sub={sub} />}
          />
          <Route
            path="/search"
            element={<Listing site={site} sub={sub} search />}
          />
          <Route path="/about" element={<Info site={site} sub={sub} />} />
          <Route
            path="/consulting"
            element={<Info site={site} sub={sub} consulting />}
          />
          <Route
            path="*"
            element={
              <Empty title="这片海域还没有信号">
                <h1>这片海域还没有信号</h1>
                <Link className="button primary" to="/">
                  返回首页
                </Link>
              </Empty>
            }
          />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <Link to="/" className="footer-brand">
            <Radio size={18} /> {site.settings.brand}
          </Link>
          <span>捕捉信号，理解变化，建立判断。</span>
          <div>
            <Link to="/about">关于</Link>
            <Link to="/consulting">咨询</Link>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
      {subscribe && (
        <Modal title="保持连接，不错过重要信号" onClose={close}>
          <p>微信读精选，小红书看日常分享。也可以直接打开下方链接。</p>
          <SubscriptionCodes site={site} expanded />
          <p className="small muted">手机可长按二维码识别或保存。</p>
        </Modal>
      )}
    </>
  );
}
function Feature({
  item,
  site,
  home = false,
}: {
  item: Content;
  site: Site;
  home?: boolean;
}) {
  return (
    <article className={"feature panel " + (home ? "home-feature" : "")}>
      <div className="feature-copy">
        <span className="badge">{home ? "本周判断" : "深度分析"}</span>
        <Link to={linkTo(item)}>
          <h2>{item.title}</h2>
        </Link>
        <p>{item.summary}</p>
        <Tags item={item} site={site} />
        <div className="feature-bottom">
          <Link to={linkTo(item)} className="text-link">
            阅读全文 <ArrowRight size={16} />
          </Link>
          <span className="muted small">{item.readMinutes} 分钟阅读</span>
        </div>
        {!home && <Meta item={item} />}
      </div>
      <Artwork variant="evolution" />
    </article>
  );
}
function Home({ site, sub }: { site: Site; sub: () => void }) {
  const hero =
    site.contents.find(
      (c) => c.id === site.settings.heroId && c.kind === "depth",
    ) || site.contents.find((c) => c.kind === "depth");
  const signals = site.settings.signalIds
    .map((id) => site.contents.find((c) => c.id === id && c.kind === "signal"))
    .filter((c): c is Content => !!c);
  const items = signals.length
    ? signals
    : site.contents.filter((c) => c.kind === "signal").slice(0, 4);
  const featured = site.settings.featuredIds
    .map((id) => site.contents.find((c) => c.id === id))
    .filter((c): c is Content => !!c);
  return (
    <>
      <section className="home-intro">
        <div>
          <div className="eyebrow">
            <span className="live-dot" /> AI 时代的独立观察站
          </div>
          <h1>
            看清 AI 变化
            <br />
            做出更好的<span className="blue">判断</span>
          </h1>
          <p>AI 新闻 · 深度解读 · 历史脉络 · 实用指南</p>
          <div className="intro-actions">
            <button className="button primary" onClick={sub}>
              订阅荒岛来信 <ArrowUpRight size={16} />
            </button>
            <Link className="text-link" to="/about">
              关于我们 <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <Artwork />
        <div className="intro-note">
          <Radio size={22} />
          <span>
            在噪声之中
            <br />
            <strong>寻找值得关注的信号</strong>
          </span>
        </div>
      </section>
      <div className="home-grid">
        {hero && (
          <div className="home-judgment">
            <Feature item={hero} site={site} home />
          </div>
        )}
        <section className="panel signals-panel">
          <SectionTitle title="最新信号" to="/signals" label="全部" />
          <p className="section-subtitle">模型发布、产品变化与值得回看的事件</p>
          <div className="signal-timeline">
            {items.map((c, i) => (
              <article key={c.id}>
                <div className="signal-stamp">
                  <span className="timeline-dot" />
                  <time>{date(c.publishedAt)}</time>
                  <span className="badge">{c.category}</span>
                </div>
                <Link to={linkTo(c)}>
                  <h3>{c.title}</h3>
                </Link>
                <p>{c.summary}</p>
                <small>来源：{c.source}</small>
                {i === 0 && (
                  <Link className="text-link" to={linkTo(c)}>
                    读取信号 <ArrowRight size={13} />
                  </Link>
                )}
              </article>
            ))}
          </div>
          <Link className="button full-width" to="/signals">
            浏览所有信号 <ArrowRight size={15} />
          </Link>
        </section>
        <section className="panel home-evolution">
          <SectionTitle title="AI 演化路线" to="/evolution" label="探索地图" />
          <p className="section-subtitle">理解 AI 如何一步步走到今天</p>
          <Timeline site={site} compact />
          <div className="route-footnote">
            <span>从规则到智能，从工具到伙伴</span>
            <ArrowRight size={15} />
          </div>
        </section>
        <section className="panel home-selected">
          <SectionTitle title="精选深度" to="/depth" label="更多深度" />
          {featured.slice(0, 2).map((c, i) => (
            <ArticleRow key={c.id} item={c} site={site} index={i + 1} />
          ))}
        </section>
        <div className="home-aside">
          <Sidebar site={site} onSubscribe={sub} />
        </div>
      </div>
      <section className="closing-strip">
        <Radio size={22} />
        <p>
          信息每天都在更新，<strong>理解值得慢慢积累。</strong>
        </p>
        <Link to="/evolution" className="text-link">
          从演化地图开始 <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}
function Timeline({
  site,
  compact = false,
  route,
}: {
  site: Site;
  compact?: boolean;
  route?: string;
}) {
  const [params] = useSearchParams();
  const icons = [Network, Layers, Network, BookOpen, Sparkles, Bot];
  return (
    <div className={"timeline " + (compact ? "compact" : "")}>
      {site.stages.map((s, i) => {
        const Icon = icons[i] || Network;
        return (
          <Link
            to={
              (route ? "/evolution/" + route : "/evolution") +
              "?stage=" +
              encodeURIComponent(s.name)
            }
            className={params.get("stage") === s.name ? "era current" : "era"}
            aria-current={params.get("stage") === s.name ? "true" : undefined}
            key={s.name}
          >
            <span className="era-icon">
              <Icon size={compact ? 18 : 28} strokeWidth={1.5} />
            </span>
            <strong>{s.name}</strong>
            <time>{s.period}</time>
            {!compact && <small>{s.description}</small>}
          </Link>
        );
      })}
    </div>
  );
}
function Depth({ site, sub }: { site: Site; sub: () => void }) {
  const hero =
    site.contents.find(
      (c) => c.id === site.settings.heroId && c.kind === "depth",
    ) || site.contents.find((c) => c.kind === "depth");
  const focus = site.contents
    .filter((c) => c.kind === "depth" && c.featured && c.id !== hero?.id)
    .slice(0, 3);
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">THE DEEPER PICTURE</div>
        <h1>
          深度解读<span className="heading-dot">.</span>
        </h1>
        <p>长篇分析 · 趋势解读 · 产品分析 · 方法论与实践</p>
      </div>
      <div className="two-column">
        <div className="main-column">
          {hero && <Feature item={hero} site={site} />}
          <section className="panel">
            <SectionTitle title="本周重点" />
            <div className="focus-grid">
              {focus.map((c, i) => (
                <article key={c.id}>
                  <Link to={linkTo(c)}>
                    <Thumb item={c} index={i + 1} />
                    <h3>{c.title}</h3>
                  </Link>
                  <p>{c.summary}</p>
                  <Meta item={c} />
                </article>
              ))}
            </div>
          </section>
          <Listing site={site} sub={sub} kind="depth" embedded />
        </div>
        <Sidebar site={site} onSubscribe={sub} />
      </div>
    </>
  );
}
function Listing({
  site,
  sub,
  kind,
  search = false,
  embedded = false,
}: {
  site: Site;
  sub: () => void;
  kind?: string;
  search?: boolean;
  embedded?: boolean;
}) {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const [bodies, setBodies] = useState<Record<string, string>>();
  const [error, setError] = useState("");
  const [input, setInput] = useState(params.get("q") || "");
  const topic = site.topics.find((t) => t.slug === slug);
  const query = params.toString();
  const q = (params.get("q") || "").trim();
  const loading = !!q && !bodies && !error;
  const filters = new URLSearchParams(query);
  if (kind) filters.set("kind", kind);
  if (slug) filters.set("topic", slug);
  const items = filterContents(site, filters, bodies);
  useEffect(() => {
    setInput(new URLSearchParams(query).get("q") || "");
  }, [query]);
  useEffect(() => {
    if (!q || bodies) return;
    let alive = true;
    loadSearch()
      .then((index) => {
        if (alive) {
          setBodies(index);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [q, bodies]);
  function update(key: string, value: string) {
    // Navigation can still be rendering when a second filter changes.
    // Merge against the actual URL so a quick action cannot discard a query.
    const p = new URLSearchParams(window.location.search);
    value ? p.set(key, value) : p.delete(key);
    setParams(p, { replace: true });
  }
  if (slug && !topic) return <Empty title="话题不存在" />;
  const title = embedded
    ? "最新深度"
    : topic
      ? "# " + topic.name
      : search
        ? "搜索荒岛书生"
        : "信号";
  const content = (
    <>
      <section className="panel filter-panel">
        {embedded && <SectionTitle title={title} />}
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            update("q", input);
          }}
        >
          <Search size={19} />
          <input
            aria-label="搜索关键词"
            autoFocus={search}
            placeholder={
              search
                ? "搜索标题、正文、话题、作者、公司或人物…"
                : "输入关键词，发现值得关注的内容…"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {input && (
            <button
              type="button"
              className="icon-button"
              aria-label="清空搜索"
              onClick={() => {
                setInput("");
                update("q", "");
              }}
            >
              <X size={15} />
            </button>
          )}
          <button className="button primary" type="submit">
            搜索
          </button>
        </form>
        <div className="filter-row">
          {!kind && (
            <label>
              类型
              <select
                aria-label="内容类型"
                value={params.get("kind") || ""}
                onChange={(e) => update("kind", e.target.value)}
              >
                <option value="">全部内容</option>
                <option value="signal">信号</option>
                <option value="depth">深度</option>
                <option value="node">演化节点</option>
              </select>
            </label>
          )}
          {kind === "signal" && (
            <>
              <label>
                分类
                <select
                  aria-label="信号分类"
                  value={params.get("category") || ""}
                  onChange={(e) => update("category", e.target.value)}
                >
                  <option value="">全部分类</option>
                  {[
                    ...new Set(
                      site.contents
                        .filter((c) => c.kind === "signal")
                        .map((c) => c.category),
                    ),
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                时间
                <select
                  aria-label="时间范围"
                  value={params.get("period") || ""}
                  onChange={(e) => update("period", e.target.value)}
                >
                  <option value="">全部时间</option>
                  <option value="today">今天</option>
                  <option value="week">本周</option>
                  <option value="month">本月</option>
                </select>
              </label>
            </>
          )}
          {!slug && (
            <label>
              话题
              <select
                aria-label="话题筛选"
                value={params.get("topic") || ""}
                onChange={(e) => update("topic", e.target.value)}
              >
                <option value="">全部话题</option>
                {site.topics.map((t) => (
                  <option value={t.slug} key={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            排序
            <select
              aria-label="排序方式"
              value={params.get("sort") || ""}
              onChange={(e) => update("sort", e.target.value)}
            >
              <option value="">相关度优先</option>
              <option value="time">最新发布</option>
            </select>
          </label>
          <button className="text-link" onClick={() => setParams({})}>
            重置筛选
          </button>
        </div>
      </section>
      <div className="results-count" role="status">
        {loading ? "正在寻找信号…" : `找到 ${items.length} 条内容`}
        {params.get("q") && <span>关键词：{params.get("q")}</span>}
      </div>
      {error ? (
        <Empty title={error} />
      ) : !loading && items.length === 0 ? (
        <Empty>
          <div className="topic-cloud">
            {site.topics.slice(0, 4).map((t) => (
              <Link key={t.slug} to={"/topics/" + t.slug}>
                # {t.name}
              </Link>
            ))}
          </div>
          {site.contents.find((c) => c.featured) && (
            <Link
              className="text-link"
              to={linkTo(site.contents.find((c) => c.featured)!)}
            >
              阅读编辑推荐 <ArrowRight size={16} />
            </Link>
          )}
        </Empty>
      ) : (
        <div className="panel result-list" aria-busy={loading}>
          {items.map((c, i) => (
            <ArticleRow key={c.id} item={c} site={site} index={i} />
          ))}
        </div>
      )}
    </>
  );
  return embedded ? (
    content
  ) : (
    <>
      <div className="page-heading">
        <div className="eyebrow">
          {search
            ? "FIND YOUR SIGNAL"
            : topic
              ? "FOLLOW THE THREAD"
              : "SIGNALS, NOT NOISE"}
        </div>
        <h1>
          {title}
          <span className="heading-dot">.</span>
        </h1>
        <p>
          {topic?.description ||
            (search
              ? "让零散的信息，连接成你的理解。"
              : "捕捉 AI 的新变化，保留值得回看的时刻。")}
        </p>
      </div>
      <div className="two-column">
        <div className="main-column">{content}</div>
        <Sidebar site={site} onSubscribe={sub} />
      </div>
    </>
  );
}
function Evolution({ site, sub }: { site: Site; sub: () => void }) {
  const { route } = useParams();
  const [params, setParams] = useSearchParams();
  const active = site.routes.find((r) => r.slug === route);
  const query = (params.get("q") || "").trim().toLocaleLowerCase();
  const nodes = site.contents
    .filter(
      (c) =>
        c.kind === "node" &&
        (!route || c.route === route) &&
        (!params.get("stage") || c.stage === params.get("stage")) &&
        (!query ||
          [c.title, c.summary, c.year, ...(c.people || [])]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query)),
    )
    .sort((a, b) => a.order - b.order);
  if (route && !active) return <Empty title="演化路线不存在" />;
  return (
    <div className="two-column evolution-layout">
      <div className="main-column">
        <section className="evolution-hero panel">
          <div>
            <div className="eyebrow">A HISTORY OF ARTIFICIAL INTELLIGENCE</div>
            <h1>{active?.name || "AI 演化地图"}</h1>
            <h3>理解 AI 从何而来，探索它将去向何方</h3>
            <p>
              {active?.description ||
                "从规则到智能，从感知到创造，从工具到伙伴。"}
              <br />
              沿着重要阶段、关键事件与人物，读懂 AI 的发展历程。
            </p>
            {active && (
              <Link className="text-link" to="/evolution">
                ← 返回演化总览
              </Link>
            )}
          </div>
          <Artwork variant="evolution" />
        </section>
        <section className="panel timeline-panel">
          <Timeline site={site} route={route} />
        </section>
        <section>
          <SectionTitle title="AI 演化路线" />
          <div className="route-grid">
            {site.routes.map((r, i) => {
              const Icon = [Network, Bot, Code2, Layers][i] || Network;
              return (
                <Link
                  key={r.slug}
                  to={"/evolution/" + r.slug}
                  className={
                    "panel route-card " + (route === r.slug ? "selected" : "")
                  }
                >
                  <div>
                    <h3>{r.name}</h3>
                    <ArrowRight size={17} />
                  </div>
                  <span className="route-emblem">
                    <Icon size={29} strokeWidth={1.3} />
                  </span>
                  <div className="route-steps">
                    {r.steps.map((x, j) => (
                      <span key={x}>
                        {x}
                        {j < 3 && <ChevronRight size={11} />}
                      </span>
                    ))}
                  </div>
                  <p>{r.description}</p>
                  <span className="text-link">
                    关键节点{" "}
                    {
                      site.contents.filter(
                        (c) => c.kind === "node" && c.route === r.slug,
                      ).length
                    }{" "}
                    个 <ArrowRight size={14} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
        <section>
          <SectionTitle
            title={
              params.get("stage")
                ? params.get("stage") + " · 关键节点"
                : "关键节点"
            }
          />
          <div className="history-controls panel">
            <label>
              查找历史节点
              <input
                type="search"
                value={params.get("q") || ""}
                placeholder="事件、年代或人物，例如 Transformer、何恺明"
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  if (e.target.value) next.set("q", e.target.value);
                  else next.delete("q");
                  setParams(next, { replace: true });
                }}
              />
            </label>
            <span role="status">{nodes.length} 个节点 · 按历史顺序</span>
            {(params.get("stage") || params.get("q")) && (
              <button className="text-link" onClick={() => setParams({})}>
                清除筛选 ×
              </button>
            )}
          </div>
          <div className="node-grid">
            {nodes.map((c, i) => (
              <Link key={c.id} className="panel node-card" to={linkTo(c)}>
                <span className={"node-icon tone-" + (i % 3)}>
                  {[<Network />, <Bot />, <Code2 />, <Sparkles />][i % 4]}
                </span>
                <h3>{c.title}</h3>
                <time>{c.year}</time>
                <p>{c.summary}</p>
                {!!c.people?.length && (
                  <small className="node-people">
                    {c.people.slice(0, 2).join(" · ")}
                    {c.people.length > 2 ? " 等" : ""}
                  </small>
                )}
                <span className="text-link">
                  了解详情 <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
          {!nodes.length && (
            <Empty
              title={
                query ? "没有找到匹配的历史节点" : "这个阶段的节点正在整理中"
              }
            />
          )}
        </section>
        <p className="small muted">
          地图中的阶段用于组织理解，彼此存在重叠；能力路线不代表严格的技术替代顺序。
        </p>
      </div>
      <Sidebar site={site} onSubscribe={sub} evolution />
    </div>
  );
}
function Topics({ site }: { site: Site }) {
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">IDEAS WORTH FOLLOWING</div>
        <h1>
          热门话题<span className="heading-dot">.</span>
        </h1>
        <p>沿着你关心的方向，连接信号、深度与演化。</p>
      </div>
      <div className="topics-grid">
        {site.topics.map((t, i) => (
          <Link
            key={t.slug}
            to={"/topics/" + t.slug}
            className="panel topic-card"
          >
            {t.cover && (
              <img className="topic-cover" src={assetUrl(t.cover)} alt="" />
            )}
            <span className="topic-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2># {t.name}</h2>
            <p>{t.description}</p>
            <div>
              <span>
                {t.count} 篇内容 · {t.heat}
              </span>
              <ArrowUpRight size={20} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
function Detail({
  site,
  sub,
  kind,
}: {
  site: Site;
  sub: () => void;
  kind: string;
}) {
  const { slug } = useParams();
  const metadata = site.contents.find(
    (c) => c.kind === kind && c.slug === slug,
  );
  const [loaded, setLoaded] = useState<Content>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const item = loaded?.id === metadata?.id ? loaded : metadata;
  const loc = useLocation();
  useEffect(() => {
    if (!metadata || metadata.body) return;
    let alive = true;
    setError("");
    loadArticle(metadata)
      .then((article) => {
        if (alive) setLoaded(article);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [metadata, retry]);
  useEffect(() => {
    if (loc.hash)
      setTimeout(
        () =>
          document
            .getElementById(decodeURIComponent(loc.hash.slice(1)))
            ?.scrollIntoView(),
        50,
      );
  }, [loc.hash, item?.body]);
  if (!item) return <Empty title="内容不存在或尚未发布" />;
  const related = site.contents
    .filter(
      (c) =>
        c.id !== item.id &&
        ((item.related || []).includes(c.id) ||
          c.topics?.some((t) => item.topics?.includes(t))),
    )
    .sort((a, b) => {
      const rank = (c: Content) => {
        const index = (item.related || []).indexOf(c.id);
        return index < 0 ? Number.MAX_SAFE_INTEGER : index;
      };
      return rank(a) - rank(b);
    })
    .slice(0, 6);
  const headings = [...item.body.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  return (
    <>
      <div className="breadcrumb">
        <Link to="/">首页</Link>
        <ChevronRight size={14} />
        <Link
          to={
            kind === "node"
              ? "/evolution"
              : kind === "signal"
                ? "/signals"
                : "/depth"
          }
        >
          {labels[kind]}
        </Link>
        <ChevronRight size={14} />
        <span>{item.category || item.title}</span>
      </div>
      <div className="reading-layout">
        <article className="panel reading">
          <span className="badge">
            {item.category}
            {item.year ? " · " + item.year : ""}
          </span>
          <h1>{item.title}</h1>
          <p className="article-lead">{item.summary}</p>
          <Meta item={item} />
          {kind === "node" && (
            <div className="history-facts">
              <span>历史时间：{item.year || "待考证"}</span>
              <Link to={"/evolution/" + item.route}>
                {site.routes.find((r) => r.slug === item.route)?.name}
              </Link>
              <Link to={"/evolution?stage=" + encodeURIComponent(item.stage)}>
                {item.stage}
              </Link>
              {!!item.people?.length && (
                <div className="people-links">
                  <strong>关键人物</strong>
                  {item.people.map((person) => (
                    <Link
                      key={person}
                      to={"/evolution?q=" + encodeURIComponent(person)}
                    >
                      {person}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          <Tags item={item} site={site} />
          {item.source && (
            <p className="source-line">
              来源：{item.source}{" "}
              {item.sourceUrl && (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  原始资料 <ExternalLink size={12} />
                </a>
              )}
            </p>
          )}
          {item.cover && (
            <img
              className="article-cover"
              src={assetUrl(item.cover)}
              alt={item.title}
            />
          )}
          <details className="mobile-toc">
            <summary>文章目录</summary>
            {headings.map((h) => (
              <a key={h} href={"#" + h.replace(/\s+/g, "-")}>
                {h}
              </a>
            ))}
          </details>
          {item.body ? (
            <Markdown body={item.body} />
          ) : error ? (
            <div className="content-error" role="alert">
              <p>{error}</p>
              <button
                className="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                重试加载正文
              </button>
            </div>
          ) : (
            <p className="loading" role="status">
              正在加载正文…
            </p>
          )}
          <div className="article-end">
            <Radio size={22} />
            <h3>读懂一次变化，积累一点判断。</h3>
            <button className="button primary" onClick={sub}>
              订阅荒岛来信 <ArrowRight size={15} />
            </button>
          </div>
        </article>
        <aside className="reading-aside">
          <div className="panel toc">
            <span className="eyebrow">本文目录</span>
            {headings.map((h, i) => (
              <a key={h} href={"#" + h.replace(/\s+/g, "-")}>
                <small>{String(i + 1).padStart(2, "0")}</small>
                {h}
              </a>
            ))}
          </div>
          <SubscribeCard site={site} onSubscribe={sub} />
        </aside>
      </div>
      <section className="related-section">
        <SectionTitle title="继续探索" />
        <div className="related-grid">
          {related.map((c) => (
            <Link key={c.id} to={linkTo(c)} className="panel">
              <span className="badge">{labels[c.kind]}</span>
              <h3>{c.title}</h3>
              <p>{c.summary}</p>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
function Info({
  site,
  sub,
  consulting = false,
}: {
  site: Site;
  sub: () => void;
  consulting?: boolean;
}) {
  return (
    <div className="info-page">
      <section className="info-hero">
        <BrandMark />
        <div className="eyebrow">
          {consulting ? "LET’S TALK" : "A SMALL ISLAND. A CLEAR SIGNAL."}
        </div>
        <h1>
          {consulting
            ? "从一个具体问题，开始交流。"
            : "在 AI 的海洋里，留一盏灯。"}
        </h1>
        <p>
          {consulting ? "AI 产品 · 内容研究 · 开发实践" : site.settings.tagline}
        </p>
      </section>
      <div className="two-column">
        <article className="panel info-copy">
          <Markdown
            body={consulting ? site.settings.consulting : site.settings.about}
          />
          {consulting && (
            <>
              <p>{site.settings.contact}</p>
              <button className="button primary" onClick={sub}>
                通过公众号联系 <ArrowUpRight size={16} />
              </button>
            </>
          )}
          {!consulting && (
            <Link className="button" to="/consulting">
              了解咨询入口 <ArrowRight size={16} />
            </Link>
          )}
        </article>
        <SubscribeCard site={site} onSubscribe={sub} />
      </div>
    </div>
  );
}
