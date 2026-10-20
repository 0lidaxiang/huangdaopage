import { lazy, Suspense, useContext, useEffect, useRef } from "react";
import { MarkdownContext } from "./markdown-context";
import { assetUrl } from "./data";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Radio,
  X,
  Clock,
  BookOpen,
  Code2,
  Network,
  Layers,
} from "lucide-react";
import type { Content, Site } from "./types";
import { date, linkTo } from "./types";

export function BrandMark() {
  return (
    <svg
      width="34"
      height="42"
      viewBox="0 0 34 42"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 39h28M7 35h20l-4-23H11L7 35Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10 15h14M9 25h16M12 5h10v7H12zM10 5l7-4 7 4M15 35v-7h4v7"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M2 8h5M27 8h5"
        stroke="#eea254"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M13 18h8v4h-8z" fill="#3478f6" />
    </svg>
  );
}
export function Artwork({ variant = "hero" }: { variant?: string }) {
  return (
    <div className={`artwork ${variant}`} aria-hidden="true">
      <img
        className="light-art"
        src={assetUrl(
          `/brand/lighthouse-${variant === "evolution" ? "evolution" : "light"}.webp`,
        )}
        alt=""
        width="698"
        height="456"
      />
      <img
        className="dark-art"
        src={assetUrl("/brand/lighthouse-dark.webp")}
        alt=""
        width="496"
        height="420"
      />
    </div>
  );
}
export function Thumb({ item, index = 0 }: { item: Content; index?: number }) {
  const Icons = [Network, Code2, Layers, BookOpen];
  const Icon = Icons[index % 4];
  return item.cover ? (
    <img className="thumb" src={assetUrl(item.cover)} alt="" loading="lazy" />
  ) : (
    <div className={`thumb diagram diagram-${index % 4}`} aria-hidden="true">
      <span className="diagram-orbit" />
      <Icon size={35} strokeWidth={1.1} />
      <span className="diagram-caption">
        {item.kind === "node"
          ? item.year
          : ["AGENT", "CODE / AI", "KNOWLEDGE", "INSIGHT"][index % 4]}
      </span>
    </div>
  );
}
export function SectionTitle({
  title,
  to,
  label = "查看全部",
}: {
  title: string;
  to?: string;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {to && (
        <Link className="text-link" to={to}>
          {label}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
export function Tags({ item, site }: { item: Content; site: Site }) {
  return (
    <div className="tags">
      {(item.topics || []).slice(0, 3).map((t) => (
        <Link key={t} to={"/topics/" + t}>
          # {site.topics.find((x) => x.slug === t)?.name || t}
        </Link>
      ))}
    </div>
  );
}
export function Meta({ item }: { item: Content }) {
  return (
    <div className="meta">
      <span className="author-dot">荒</span>
      <span>{item.author || "荒岛编辑部"}</span>
      <span>
        <Clock size={12} />
        {item.readMinutes || 3} 分钟阅读
      </span>
      <time dateTime={item.publishedAt}>{date(item.publishedAt)}</time>
    </div>
  );
}
export function ArticleRow({
  item,
  site,
  index = 0,
}: {
  item: Content;
  site: Site;
  index?: number;
}) {
  return (
    <article className="article-row">
      <Link to={linkTo(item)} tabIndex={-1} aria-hidden="true">
        <Thumb item={item} index={index} />
      </Link>
      <div>
        <Link to={linkTo(item)}>
          <h3>{item.title}</h3>
        </Link>
        <p>{item.summary}</p>
        <div className="row-bottom">
          <Meta item={item} />
          <Tags item={item} site={site} />
        </div>
      </div>
    </article>
  );
}
export function SubscribeCard({
  site,
  onSubscribe,
}: {
  site: Site;
  onSubscribe: () => void;
}) {
  return (
    <section className="panel subscribe-card">
      <div className="eyebrow">
        <Radio size={15} /> 保持连接
      </div>
      <h3>不错过，下一个重要信号。</h3>
      <p>扫码接收每周精选与重要 AI 信号</p>
      <div className="subscribe-bottom">
        <div>
          <strong>{site.settings.wechatName}</strong>
          <small>在信息噪声中，找到方向。</small>
          <button className="text-link" onClick={onSubscribe}>
            订阅更新 <ArrowRight size={14} />
          </button>
        </div>
        <button
          className="qr-mini"
          onClick={onSubscribe}
          aria-label="查看公众号二维码"
        >
          {site.settings.qrCode ? (
            <img src={assetUrl(site.settings.qrCode)} alt="公众号二维码" />
          ) : (
            <>
              <Radio size={25} />
              <small>二维码待配置</small>
            </>
          )}
        </button>
      </div>
    </section>
  );
}
export function Sidebar({
  site,
  onSubscribe,
  evolution = false,
}: {
  site: Site;
  onSubscribe: () => void;
  evolution?: boolean;
}) {
  const rec = site.settings.sidebarIds
    .map((id) => site.contents.find((c) => c.id === id))
    .filter((x): x is Content => !!x);
  const lookback = site.contents.find((c) => c.kind === "node" && c.featured);
  return (
    <aside className="sidebar">
      {evolution && lookback && (
        <section className="panel lookback">
          <span className="eyebrow">沿时间回看</span>
          <h3>
            {lookback.year} · {lookback.title}
          </h3>
          <p>{lookback.summary}</p>
          <Link className="text-link" to={linkTo(lookback)}>
            回顾这个节点 <ArrowRight size={14} />
          </Link>
        </section>
      )}
      <section className="panel">
        <SectionTitle title="热门话题" to="/topics" label="更多" />
        <div className="topic-cloud">
          {site.topics.map((t) => (
            <Link to={"/topics/" + t.slug} key={t.slug}>
              # {t.name}
              <small>{t.count}</small>
            </Link>
          ))}
        </div>
        <p className="muted small">从一个话题，连接更多值得读的内容。</p>
      </section>
      <section className="panel">
        <SectionTitle
          title={evolution ? "推荐演化文章" : "本周推荐"}
          to="/depth"
          label="更多"
        />
        {rec.map((c, i) => (
          <Link className="mini-article" key={c.id} to={linkTo(c)}>
            <Thumb item={c} index={i} />
            <div>
              <h4>{c.title}</h4>
              <small>{c.readMinutes} 分钟阅读</small>
            </div>
          </Link>
        ))}
      </section>
      <SubscribeCard site={site} onSubscribe={onSubscribe} />
      <section className="panel quiet-panel">
        <h3>你好，这里是荒岛。</h3>
        <p>
          一个独立观察 AI 的地方。
          <br />
          让信息成为理解，让理解带来判断。
        </p>
        <Link to="/about" className="text-link">
          认识我们 <ArrowRight size={14} />
        </Link>
      </section>
    </aside>
  );
}
export function Markdown({ body }: { body: string }) {
  const Renderer = useContext(MarkdownContext);
  if (Renderer) return <Renderer body={body} />;
  return (
    <Suspense
      fallback={
        <p className="muted" role="status">
          正在排版正文…
        </p>
      }
    >
      <LazyMarkdown body={body} />
    </Suspense>
  );
}
const LazyMarkdown = lazy(() => import("./Markdown"));
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", handle);
      old?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <button
          className="icon-button modal-close"
          aria-label="关闭弹窗"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">
          <Radio size={16} /> 荒岛来信
        </span>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
export function Empty({
  title = "暂时没有找到相关内容",
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty panel">
      <SearchIcon />
      <h3>{title}</h3>
      <p>换一个关键词，或从热门话题开始探索。</p>
      {children || (
        <Link className="button" to="/topics">
          浏览热门话题 <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
function SearchIcon() {
  return <Radio size={32} strokeWidth={1.2} />;
}
