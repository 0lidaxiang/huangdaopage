import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { loadSite, basePath } from "./data";
import type { Site } from "./types";
import type { ComponentType } from "react";
import { MarkdownContext } from "./markdown-context";
import "./styles.css";

const root = document.getElementById("root")!;
const data = document.getElementById("page-data");
const render = (
  site: Site,
  Markdown: ComponentType<{ body: string }> | null = null,
) => (
  <React.StrictMode>
    <BrowserRouter basename={basePath}>
      <MarkdownContext.Provider value={Markdown}>
        <App initialSite={site} />
      </MarkdownContext.Provider>
    </BrowserRouter>
  </React.StrictMode>
);
async function start() {
  if (data) {
    const site = JSON.parse(data.textContent || "{}") as Site;
    const Markdown = root.querySelector(".markdown")
      ? (await import("./Markdown")).default
      : null;
    // A static 404 is shared by unknown URLs; render its actual browser location.
    if (data.dataset.notFound || window.location.search)
      createRoot(root).render(render(site, Markdown));
    else hydrateRoot(root, render(site, Markdown));
  } else {
    loadSite()
      .then((site) => createRoot(root).render(render(site)))
      .catch(() => {
        root.textContent =
          "静态内容加载失败。请检查构建产物是否完整，再刷新页面。";
      });
  }
}
void start();
