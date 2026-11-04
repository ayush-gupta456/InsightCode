import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  Download,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  LoaderCircle,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
  X,
  RotateCcw,
} from "lucide-react";
import { api, post } from "./api";
import { Badge, Empty, ErrorBox, Loading, Modal, PageTitle } from "./ui";
import { CodeDiff, CodeEditor } from "./editor";
import { ConnectedRepositories, GitHubReviewActions } from './integrations';
import type {
  Fix,
  Finding,
  Message,
  Project,
  Review,
  SourceFile,
} from "../shared/types";

export function NewReview() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") || "paste");
  const [name, setName] = useState("");
  const [filename, setFilename] = useState("main.ts");
  const [code, setCode] = useState("");
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [zip, setZip] = useState<File | null>(null);
  const [project, setProject] = useState(params.get("project") || "");
  const [ai, setAi] = useState(false);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("HEAD");
  const [branches, setBranches] = useState<string[]>([]);
  const [error, setError] = useState<unknown>();
  const [loadingBranches, setLoadingBranches] = useState(false);
  const navigate = useNavigate();
  const client = useQueryClient();
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/projects"),
  });
  const caps = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => api("/capabilities"),
  });
  const submit = useMutation({
    mutationFn: async () => {
      const base = {
        name: name || (mode === "github" ? `${owner}/${repo}` : filename),
        ai,
        ...(project ? { projectId: project } : {}),
      };
      if (mode === "github")
        return post<Review>("/github/review", {
          ...base,
          owner,
          repo,
          ref: branch,
        });
      if (mode === "zip") {
        if (!zip) throw new Error("Choose a ZIP file");
        const data = new FormData();
        data.append("file", zip);
        data.append("name", name || zip.name);
        data.append("ai", String(ai));
        if (project) data.append("projectId", project);
        return api<Review>("/reviews/zip", { method: "POST", body: data });
      }
      const sources =
        mode === "files" ? files : [{ path: filename, content: code }];
      if (!sources.length || !sources.some((f) => f.content.trim()))
        throw new Error("Add source code before starting a review");
      return post<Review>("/reviews", { ...base, files: sources });
    },
    onSuccess: (r) => {
      void client.invalidateQueries({ queryKey: ["reviews"] });
      navigate(`/app/reviews/${r.id}`);
    },
  });
  return (
    <>
      <PageTitle
        eyebrow="A FRESH PERSPECTIVE"
        title="New code review"
        description="Bring your code. We'll help you see what matters."
      />
      <div className="new-review-grid">
        <section className="panel source-panel">
          <div className="tabs">
            {[
              [Code2, "paste", "Paste code"],
              [Upload, "files", "Upload files"],
              [FolderGit2, "zip", "ZIP repository"],
              [GitBranch, "github", "GitHub"],
            ].map(([Icon, id, label]: any) => (
              <button
                key={id}
                className={mode === id ? "active" : ""}
                onClick={() => {
                  setMode(id);
                  setError(undefined);
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          {mode === "paste" ? (
            <>
              <div className="editor-toolbar">
                <FileCode2 size={17} />
                <input
                  aria-label="Source filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="main.ts"
                />
                <Badge>Auto language detection</Badge>
              </div>
              <div className="submission-editor">
                <CodeEditor
                  path={`draft/${filename}`}
                  value={code}
                  onChange={setCode}
                />
                {!code && (
                  <div className="editor-placeholder">
                    Paste your code here to get a fresh perspective.
                  </div>
                )}
              </div>
            </>
          ) : mode === "github" ? (
            <div className="source-form">
              <div className="empty-icon">
                <GitBranch size={26} />
              </div>
              <h2>Review a GitHub repository</h2>
              <ConnectedRepositories onSelect={(owner,repo,branch)=>{setOwner(owner);setRepo(repo);setBranch(branch);}}/>
              <p className="muted">
                Imports up to 200 source files, with a 2 MB source limit.
              </p>
              <div className="form-grid">
                <label>
                  Owner
                  <input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="organization"
                  />
                </label>
                <label>
                  Repository
                  <input
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    placeholder="repository"
                  />
                </label>
              </div>
              <button
                disabled={!owner || !repo || loadingBranches}
                onClick={async () => {
                  setLoadingBranches(true);
                  try {
                    const data = await api<any[]>(
                      `/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
                    );
                    setBranches(data.map((b) => b.name));
                  } catch (e) {
                    setError(e);
                  } finally {
                    setLoadingBranches(false);
                  }
                }}
              >
                {loadingBranches ? "Loading…" : "Load branches"}
              </button>
              <label>
                Branch or commit
                {branches.length ? (
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    <option value="HEAD">Default branch</option>
                    {branches.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  />
                )}
              </label>
              <Link className="text-link" to="/app/pulls">
                Review a pull request instead <ArrowUpRightIcon />
              </Link>
            </div>
          ) : (
            <div className="source-form">
              <label className="upload-zone">
                <Upload size={33} />
                <strong>
                  {mode === "zip"
                    ? "Choose a source ZIP"
                    : "Choose your source files"}
                </strong>
                <span>
                  {mode === "zip"
                    ? "5 MB compressed · 2 MB expanded · 200 source files"
                    : "Up to 200 text files · 250 KB each · 2 MB total"}
                </span>
                <input
                  type="file"
                  multiple={mode === "files"}
                  accept={
                    mode === "zip"
                      ? ".zip"
                      : ".ts,.tsx,.js,.jsx,.mjs,.py,.java,.go,.rs,.json,.html,.css,.md,.yml,.yaml"
                  }
                  onChange={async (e) => {
                    setError(undefined);
                    try {
                      const chosen = Array.from(e.target.files || []);
                      if (mode === "zip") {
                        const f = chosen[0];
                        if (f?.size > 5_000_000)
                          throw new Error("ZIP must be under 5 MB");
                        setZip(f || null);
                      } else {
                        if (
                          chosen.length > 200 ||
                          chosen.some((f) => f.size > 250_000) ||
                          chosen.reduce((n, f) => n + f.size, 0) > 2_000_000
                        )
                          throw new Error(
                            "Selected files exceed the source limits",
                          );
                        setFiles(
                          await Promise.all(
                            chosen.map(async (f) => ({
                              path: f.name,
                              content: await f.text(),
                            })),
                          ),
                        );
                      }
                    } catch (err) {
                      setError(err);
                    }
                  }}
                />
              </label>
              {zip && mode === "zip" && (
                <div className="uploaded-file">
                  <FolderGit2 size={17} />
                  {zip.name}
                  <Badge>{(zip.size / 1000).toFixed(0)} KB</Badge>
                </div>
              )}
              {mode === "files" &&
                files.map((f) => (
                  <div className="uploaded-file" key={f.path}>
                    <FileCode2 size={17} />
                    {f.path}
                    <button
                      className="icon-button"
                      aria-label={`Remove ${f.path}`}
                      onClick={() =>
                        setFiles(files.filter((x) => x.path !== f.path))
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </section>
        <aside>
          <section className="panel review-options">
            <h2>Review details</h2>
            <label>
              Review name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="A name to find this review later"
              />
            </label>
            <label>
              Project
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">Personal workspace</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="divider" />
            <h3>Analysis</h3>
            <div className="analysis-option">
              <Check size={17} className="ink-green" />
              <div>
                <strong>Deterministic checks</strong>
                <p>Source evidence, rule matches, and repository indexing.</p>
              </div>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ai}
                disabled={!caps.data?.gemini}
                onChange={(e) => setAi(e.target.checked)}
              />
              <span>
                <strong>Gemini AI enrichment</strong>
                <small>
                  {caps.data?.gemini
                    ? "Send bounded source context to Google for deeper analysis."
                    : "Configure Gemini in your server settings to enable."}
                </small>
              </span>
            </label>
            <ErrorBox error={error || submit.error} />
            <button
              className="primary start-review"
              disabled={submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <ScanIcon />
              )}
              {submit.isPending ? "Preparing review…" : "Start review"}
              <ArrowRight size={16} />
            </button>
          </section>
          <div className="privacy-note">
            <ShieldCheck size={18} />
            <p>
              Source is inspected as text. Uploaded code is never executed by
              the API.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={14} />;
}
function ScanIcon() {
  return <Play size={16} />;
}
export function ReviewWorkspace() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["review", id],
    queryFn: () => api<Review>(`/reviews/${id}`),
    refetchInterval: (query) =>
      query.state.data &&
      ["running", "queued"].includes(query.state.data.status)
        ? 1000
        : false,
  });
  const [path, setPath] = useState("");
  const [selected, setSelected] = useState(params.get("finding") || "");
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("findings");
  const [fileSearch, setFileSearch] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const r = q.data;
  const finding = r?.findings.find((f) => f.id === selected);
  const current =
    r?.files.find((f) => f.path === (path || finding?.file)) || r?.files[0];
  const fixes = useQuery({
    queryKey: ["fixes", id],
    queryFn: () => api<Fix[]>(`/reviews/${id}/fixes`),
    enabled: !!r,
  });
  const index = useQuery({
    queryKey: ["index", id],
    queryFn: () => api<any[]>(`/reviews/${id}/index`),
    enabled: !!r,
  });
  useEffect(() => {
    if (finding) {
      setPath(finding.file);
      setEdit(null);
    }
  }, [selected]);
  if (q.isLoading) return <Loading />;
  if (q.error || !r || !current)
    return <ErrorBox error={q.error || "Review not found"} />;
  const visible = r.findings.filter(
    (f) => (filter === "all" || f.severity === filter) && f.status === "open",
  );
  async function preview(aiFinding?: Finding) {
    setError(undefined);
    setBusy(true);
    try {
      setFix(
        await post(`/reviews/${id}/fixes`, {
          file: aiFinding?.file || current!.path,
          ...(aiFinding ? { findingId: aiFinding.id } : { replacement: edit }),
        }),
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function apply(action: "apply" | "revert", patch: Fix) {
    setBusy(true);
    setError(undefined);
    try {
      await post(`/fixes/${patch.id}/${action}`, { approved: true });
      setFix(null);
      setEdit(null);
      for (const key of [
        ["review", id],
        ["fixes", id],
        ["reviews"],
        ["analytics"],
        ["index", id],
      ])
        void client.invalidateQueries({ queryKey: key });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="review-heading">
        <Link
          className="icon-button"
          to="/app/history"
          aria-label="Back to reviews"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1>{r.name}</h1>
          <p>
            {r.files.length} files · {r.source} · Revision {r.revision}
          </p>
        </div>
        <Badge tone={r.status === "completed" ? "green" : "violet"}>
          {r.status}
        </Badge>
        <button className="logs-button" onClick={() => setShowLogs(true)}>
          <Terminal size={15} />
          Review logs
        </button>
      </div>
      {r.status !== "completed" && (
        <div className="progress-banner">
          <LoaderCircle
            className={r.status === "failed" ? "" : "spin"}
            size={18}
          />
          {r.error || r.logs.at(-1)}
        </div>
      )}
      <ErrorBox error={error} />
      <GitHubReviewActions review={r}/>
      <div className="review-workspace">
        <aside className="file-explorer">
          <div className="pane-heading">
            <FolderGit2 size={16} />
            EXPLORER<Badge>{r.files.length}</Badge>
          </div>
          <div className="file-search">
            <Search size={14} />
            <input
              aria-label="Search files"
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              placeholder="Find a file…"
            />
          </div>
          <div className="file-list">
            {r.files
              .filter((f) =>
                f.path.toLowerCase().includes(fileSearch.toLowerCase()),
              )
              .map((f) => (
                <button
                  className={current.path === f.path ? "active" : ""}
                  key={f.path}
                  title={f.path}
                  onClick={() => {
                    setPath(f.path);
                    setEdit(null);
                    setSelected("");
                  }}
                >
                  <FileCode2 size={15} />
                  <span>{f.path}</span>
                  {r.findings.some(
                    (x) => x.file === f.path && x.status === "open",
                  ) && <i className="finding-dot" />}
                </button>
              ))}
          </div>
          <div className="explorer-bottom">
            <span className="status-dot" /> Isolated source snapshot
          </div>
        </aside>
        <section className="code-pane">
          <div className="pane-heading">
            <FileCode2 size={16} />
            <span>{current.path}</span>
            <button
              className="text-link"
              onClick={() => setEdit(edit === null ? current.content : null)}
              disabled={r.status !== "completed"}
            >
              {edit === null ? "Edit snapshot" : "Cancel edit"}
            </button>
          </div>
          <div className="workspace-editor">
            <CodeEditor
              path={`${id}/${current.path}`}
              value={edit ?? current.content}
              onChange={setEdit}
              readOnly={edit === null}
              line={
                finding?.file === current.path ? finding.startLine : undefined
              }
            />
          </div>
          <div className="editor-status">
            <span>{current.content.split("\n").length} lines · UTF-8</span>
            {edit !== null ? (
              <button
                className="primary small-button"
                disabled={busy || edit === current.content}
                onClick={() => preview()}
              >
                Preview changes
              </button>
            ) : (
              <span>Read only</span>
            )}
          </div>
        </section>
        <aside className="assistant-pane">
          <div className="tabs compact">
            <button
              className={tab === "findings" ? "active" : ""}
              onClick={() => setTab("findings")}
            >
              Findings <Badge>{visible.length}</Badge>
            </button>
            <button
              className={tab === "chat" ? "active" : ""}
              onClick={() => setTab("chat")}
            >
              <Sparkles size={14} />
              Assistant
            </button>
            <button
              className={tab === "index" ? "active" : ""}
              onClick={() => setTab("index")}
            >
              Index
            </button>
          </div>
          {tab === "findings" ? (
            <div className="findings-pane">
              <div className="findings-summary">
                <div>
                  <strong>
                    {r.score ?? "—"}
                    <small>/100</small>
                  </strong>
                  <span>Review score</span>
                </div>
                <select
                  aria-label="Filter severity"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {["all", "critical", "high", "medium", "low"].map((s) => (
                    <option key={s} value={s}>
                      {s === "all" ? "All severities" : s}
                    </option>
                  ))}
                </select>
              </div>
              {!visible.length ? (
                <Empty
                  title={
                    r.status === "completed"
                      ? "No open findings"
                      : "Analysis in progress"
                  }
                >
                  {r.status === "completed"
                    ? "No issues matched the active checks. This does not certify that the code is secure."
                    : "Findings will appear here as checks complete."}
                </Empty>
              ) : (
                visible.map((f) => (
                  <article
                    className={`finding-card ${selected === f.id ? "selected" : ""}`}
                    key={f.id}
                  >
                    <button
                      className="finding-select"
                      onClick={() => setSelected(f.id)}
                    >
                      <div>
                        <Badge
                          tone={
                            ["high", "critical"].includes(f.severity)
                              ? "red"
                              : "amber"
                          }
                        >
                          {f.severity}
                        </Badge>
                        <span>
                          {Math.round(f.confidence * 100)}% confidence
                        </span>
                      </div>
                      <h3>{f.title}</h3>
                      <code>
                        {f.file}:{f.startLine}
                      </code>
                    </button>
                    {selected === f.id && (
                      <div className="finding-detail">
                        <Badge>{f.verification}</Badge>
                        <p>{f.description}</p>
                        <h4>Why it matters</h4>
                        <p>{f.impact}</p>
                        <h4>Recommendation</h4>
                        <p>{f.recommendation}</p>
                        <div className="finding-actions">
                          <button disabled={busy} onClick={() => preview(f)}>
                            <Sparkles size={14} />
                            Suggest fix
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await api(`/reviews/${id}/findings/${f.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ status: "dismissed" }),
                                });
                                void client.invalidateQueries();
                              } catch (e) {
                                setError(e);
                              }
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                        <small className="muted">
                          {f.engine} · Source evidence at line {f.startLine}
                        </small>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          ) : tab === "chat" ? (
            <Chat reviewId={r.id} />
          ) : (
            <div className="index-pane">
              <h3>Source structure</h3>
              <p className="muted">
                AST symbols and imports for JavaScript and TypeScript.
              </p>
              <ErrorBox error={index.error} />
              {index.data
                ?.filter((f) => f.path === current.path)
                .map((f) => (
                  <div key={f.path}>
                    <Badge>{f.language}</Badge>
                    <h4>Symbols</h4>
                    {f.symbols.length ? (
                      f.symbols.map((s: any, i: number) => (
                        <div className="symbol-row" key={i}>
                          <code>{s.name}</code>
                          <span>L{s.line}</span>
                        </div>
                      ))
                    ) : (
                      <p className="muted">No indexed symbols.</p>
                    )}
                    <h4>Dependencies</h4>
                    {f.imports.map((s: string, i: number) => (
                      <code className="dependency" key={i}>
                        {s}
                      </code>
                    ))}
                    <h4>Frameworks</h4>
                    <p className="muted">
                      {f.frameworks.join(", ") || "None detected from imports"}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </aside>
      </div>
      {fixes.data?.some((f) => f.status === "applied") && (
        <section className="panel applied-fixes">
          <h3>Applied patches</h3>
          {fixes.data
            .filter((f) => f.status === "applied")
            .map((f) => (
              <div className="setting-row" key={f.id}>
                <div>
                  <strong>{f.file}</strong>
                  <p className="muted">{f.validation}</p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => {
                    setFix(f);
                  }}
                >
                  <RotateCcw size={14} />
                  Review / revert
                </button>
              </div>
            ))}
        </section>
      )}
      <Modal
        open={!!fix}
        onOpenChange={(open) => {
          if (!open) setFix(null);
        }}
        title={
          fix?.status === "applied"
            ? "Review applied patch"
            : "Review proposed changes"
        }
        description="Changes apply to this stored source snapshot. Isolated tests require a configured Docker worker."
      >
        {fix && (
          <>
            <CodeDiff original={fix.original} modified={fix.replacement} />
            <details>
              <summary>Unified diff</summary>
              <pre className="diff-text">{fix.diff}</pre>
            </details>
            <ErrorBox error={error} />
            <div className="modal-actions">
              <button disabled={busy} onClick={async()=>{setBusy(true);setError(undefined);try{setFix(await post(`/fixes/${fix.id}/validate`,{approved:true}));}catch(e){setError(e);}finally{setBusy(false);}}}>Run isolated tests</button>
              <button onClick={() => setFix(null)}>Cancel</button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  apply(fix.status === "applied" ? "revert" : "apply", fix)
                }
              >
                {fix.status === "applied"
                  ? "Approve revert"
                  : "Approve & apply to snapshot"}
              </button>
            </div>
            {fix.validation && <p role="status">{fix.validation}</p>}
            {fix.validationDetails && <details><summary>Test output</summary><pre>{fix.validationDetails.patched.output}</pre></details>}
          </>
        )}
      </Modal>
      <Modal
        open={showLogs}
        onOpenChange={setShowLogs}
        title="Review progress"
        description={`Status: ${r.status}`}
      >
        <ol className="review-logs">
          {r.logs.map((log, i) => (
            <li key={i}>
              <Check size={15} />
              {log}
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}
function Chat({ reviewId }: { reviewId: string }) {
  const q = useQuery({
    queryKey: ["messages", reviewId],
    queryFn: () => api<Message[]>(`/reviews/${reviewId}/messages`),
  });
  const [content, setContent] = useState("");
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => post(`/reviews/${reviewId}/messages`, { content }),
    onSuccess: () => {
      setContent("");
      void client.invalidateQueries({ queryKey: ["messages", reviewId] });
    },
  });
  return (
    <div className="chat-pane">
      <div className="messages">
        {!q.data?.length && (
          <div className="chat-welcome">
            <Sparkles size={28} />
            <h3>A second perspective.</h3>
            <p>Ask about bugs, architecture, tests, or how this code works.</p>
            {[
              "Explain the architecture",
              "Where should I add validation?",
              "Suggest useful tests",
            ].map((s) => (
              <button key={s} onClick={() => setContent(s)}>
                {s}
                <ArrowRight size={13} />
              </button>
            ))}
            <small>
              Requires Gemini configuration. Relevant source context is sent to
              Google.
            </small>
          </div>
        )}
        {q.data?.map((m) => (
          <div className={`message ${m.role}`} key={m.id}>
            <strong>{m.role === "user" ? "You" : "InsightCode"}</strong>
            <p>{m.content}</p>
          </div>
        ))}
        {mutation.isPending && (
          <div className="message">
            <LoaderCircle className="spin" size={15} />
            Thinking with your source context…
          </div>
        )}
        <ErrorBox error={q.error || mutation.error} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <textarea
          aria-label="Ask the AI assistant"
          value={content}
          maxLength={4000}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ask about this code…"
        />
        <button
          className="primary icon-button"
          aria-label="Send message"
          disabled={mutation.isPending || !content.trim()}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
