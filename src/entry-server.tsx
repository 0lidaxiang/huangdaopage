import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import App from "./App";
import type { Site } from "./types";
import { assetUrl, basePath } from "./data";
import Markdown from "./Markdown";
import { MarkdownContext } from "./markdown-context";
export { pageInfo } from "./seo";

export function render(path: string, site: Site) {
  return renderToString(
    <StaticRouter location={assetUrl(path)} basename={basePath}>
      <MarkdownContext.Provider value={Markdown}>
        <App initialSite={site} />
      </MarkdownContext.Provider>
    </StaticRouter>,
  );
}
