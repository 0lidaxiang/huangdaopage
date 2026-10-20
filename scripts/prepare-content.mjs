import { readFile, mkdir, rm, cp, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateContent } from "./validate-content.mjs";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function prepareContent() {
  const { site, provenance } = await validateContent();
  const target = resolve(root, ".generated/public");
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(resolve(root, "public"), target, { recursive: true });
  await mkdir(resolve(target, "data"), { recursive: true });
  await cp(
    resolve(root, "content/articles"),
    resolve(target, "data/articles"),
    { recursive: true },
  );
  await writeFile(resolve(target, "data/site.json"), JSON.stringify(site));
  const bodies = {};
  for (const item of site.contents)
    bodies[item.id] = JSON.parse(
      await readFile(
        resolve(root, "content/articles", item.kind, item.slug + ".json"),
        "utf8",
      ),
    ).body;
  await writeFile(
    resolve(target, "data/search-index.json"),
    JSON.stringify(bodies),
  );
  return { site, provenance };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareContent();
