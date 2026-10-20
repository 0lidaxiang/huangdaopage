import { createContext } from "react";
import type { ComponentType } from "react";

// The static renderer supplies Markdown eagerly. Browsers load it only for prose.
export const MarkdownContext = createContext<ComponentType<{
  body: string;
}> | null>(null);
