import { HttpError } from "./security.js";
import { language } from "./analysis.js";
import type { SourceFile } from "../shared/types.js";
const segment = (s: string) => encodeURIComponent(s);
export async function githubGet(endpoint: string, token?: string) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw new HttpError(
      response.status === 404 ? 404 : 502,
      `GitHub request failed (${response.status}). Check repository access and rate limits.`,
    );
  const text = await response.text();
  if (text.length > 8_000_000)
    throw new HttpError(413, "GitHub response too large");
  return JSON.parse(text);
}
export async function repositoryFiles(
  owner: string,
  repo: string,
  ref: string,
  token?: string,
  pull?: number,
) {
  const base = `/repos/${segment(owner)}/${segment(repo)}`;
  let paths: string[];
  let commit = ref;
  if (pull) {
    const pr = await githubGet(`${base}/pulls/${pull}`, token);
    commit = pr.head.sha;
    if (pr.changed_files > 100)
      throw new HttpError(413, "Pull request exceeds 100 changed files");
    const changed = await githubGet(
      `${base}/pulls/${pull}/files?per_page=100`,
      token,
    );
    paths = changed
      .filter((f: any) => f.status !== "removed")
      .map((f: any) => f.filename);
  } else {
    const resolved = await githubGet(`${base}/commits/${segment(ref)}`, token);
    commit = resolved.sha;
    const tree = await githubGet(
      `${base}/git/trees/${segment(commit)}?recursive=1`,
      token,
    );
    if (tree.truncated)
      throw new HttpError(
        413,
        "Repository tree is too large. Upload a smaller source ZIP.",
      );
    paths = tree.tree
      .filter((f: any) => f.type === "blob" && f.size <= 250_000)
      .map((f: any) => f.path);
  }
  paths = paths.filter(
    (p) =>
      language(p) !== "plaintext" &&
      !/(^|\/)(node_modules|vendor|dist|\.git)(\/|$)/.test(p),
  );
  if (paths.length > 200)
    throw new HttpError(
      413,
      "Repository exceeds 200 supported source files. Select a smaller repository or upload a source subset.",
    );
  const files: SourceFile[] = [];
  let size = 0;
  for (const path of paths) {
    const data = await githubGet(
      `${base}/contents/${path.split("/").map(segment).join("/")}?ref=${segment(commit)}`,
      token,
    );
    if (
      data.type !== "file" ||
      data.encoding !== "base64" ||
      data.size > 250_000
    )
      continue;
    const content = Buffer.from(data.content, "base64").toString("utf8");
    size += Buffer.byteLength(content);
    if (size > 2_000_000)
      throw new HttpError(413, "Repository source exceeds 2 MB");
    files.push({ path, content });
  }
  return {files,commit};
}
