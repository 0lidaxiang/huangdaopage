import type { CSSProperties } from "react";
import { assetUrl } from "./data";
import snapshot from "../content/figures/aa-intelligence-2026-10-20.json";

type Model = (typeof snapshot.rows)[number];

function RankingRows({ rows, start = 0 }: { rows: Model[]; start?: number }) {
  return (
    <ol className="aa-ranking-rows" start={start + 1}>
      {rows.map((model, index) => (
        <li className="aa-ranking-row" key={model.slug} data-model={model.slug}>
          <span className="aa-row-number" aria-hidden="true">
            {String(start + index + 1).padStart(2, "0")}
          </span>
          <div className="aa-model-label">
            <strong>{model.name}</strong>
            <span>
              {model.creator}
              {model.configuration ? ` · ${model.configuration}` : ""}
            </span>
            {!model.publicApi && (
              <span className="aa-api-note">无公开 API</span>
            )}
          </div>
          <span
            className="aa-score"
            aria-label={`智能指数 ${model.displayScore}`}
          >
            {model.displayScore}
          </span>
          <div className="aa-bar-track" aria-hidden="true">
            <span
              className={`aa-bar${model.publicApi ? "" : " aa-bar-checkered"}`}
              data-creator={model.creator}
              style={
                {
                  width: `${(model.score / snapshot.scoreScaleMax) * 100}%`,
                  "--aa-entity": model.color,
                } as CSSProperties
              }
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function IntelligenceRanking() {
  return (
    <figure
      className="article-figure aa-ranking"
      aria-labelledby="aa-ranking-title"
    >
      <figcaption className="aa-figure-heading">
        <span className="aa-figure-kicker">
          ARTIFICIAL ANALYSIS · v{snapshot.version}
        </span>
        <h3 id="aa-ranking-title">模型智能指数</h3>
        <p>32 个展示配置 · 分数越高越好 · 2026 年 10 月 20 日快照</p>
      </figcaption>
      <div className="aa-figure-legend">
        <span>沿用官方品牌色</span>
        <span>
          <i className="aa-checkered-key" aria-hidden="true" /> 无公开 API
        </span>
      </div>
      <div className="aa-axis" aria-hidden="true">
        {[0, 20, 40, 60].map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
      <RankingRows rows={snapshot.rows.slice(0, 13)} />
      <details className="aa-more-rows">
        <summary>展开其余 19 个配置，查看全部 32 项</summary>
        <RankingRows rows={snapshot.rows.slice(13)} start={13} />
      </details>
      <p className="aa-figure-note">
        分数按原图取整，顺序保留官方未取整分数的排序；相同整数不表示精确分数相等。
        这 32 项是页面展示的配置，不是 696
        项完整榜单。方格纹和文字同时标注无公开 API 的条目。
      </p>
      <a
        className="aa-source-link"
        href={snapshot.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        数据与原始榜单：Artificial Analysis ↗
      </a>
    </figure>
  );
}

function IntelligenceCost() {
  return (
    <figure className="article-figure aa-cost" aria-labelledby="aa-cost-title">
      <figcaption className="aa-figure-heading">
        <span className="aa-figure-kicker">INTELLIGENCE × COST</span>
        <h3 id="aa-cost-title">同一张榜，换成成本视角</h3>
        <p>纵轴为智能指数，横轴为单任务美元成本（对数坐标）。</p>
      </figcaption>
      <a
        className="aa-cost-image"
        href={assetUrl(snapshot.costFigure.url)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="在新窗口查看智能指数与成本图的高清原图"
      >
        <img
          src={assetUrl(snapshot.costFigure.url)}
          alt="Artificial Analysis 智能指数与单任务成本散点图，2026年10月20日截图；同等得分下越靠左，成本越低。"
          width="2388"
          height="1384"
          loading="lazy"
        />
        <span>查看高清原图 ↗</span>
      </a>
      <p className="aa-figure-note">
        2026 年 10 月 20 日榜单快照。手机端可点开原图放大。
        绿色区域与帕累托虚线按原图保留；图表来源：Artificial Analysis。
      </p>
    </figure>
  );
}

// Markdown may select these reviewed, local figures. It cannot execute code,
// select arbitrary files, or load a remote chart.
export function articleFigure(id: string) {
  switch (id) {
    case "aa-intelligence-2026-10-20":
      return <IntelligenceRanking />;
    case "aa-cost-2026-10-20":
      return <IntelligenceCost />;
    default:
      return null;
  }
}
