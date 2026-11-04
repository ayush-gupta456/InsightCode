import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  ScanLine,
  ShieldCheck,
  FolderGit2,
  GitPullRequest,
  Sparkles,
  Search,
  FileCode2,
  Check,
  Activity,
  Clock3,
  SlidersHorizontal,
  GitBranch,
  LockKeyhole,
  ExternalLink,
} from "lucide-react";
import { api, post, useSession } from "./api";
import { Badge, Empty, ErrorBox, Loading, Modal, PageTitle, date } from "./ui";
import type { Review, Project, Finding } from "../shared/types";
import { GitHubConnection } from './integrations';
import TeamManagement from './team';

type Summary = Omit<Review, "files"> & { fileCount: number };
export const useReviews = () =>
  useQuery({
    queryKey: ["reviews"],
    queryFn: () => api<Summary[]>("/reviews"),
    refetchInterval: (query) =>
      query.state.data?.some(
        (r) => r.status === "running" || r.status === "queued",
      )
        ? 1500
        : false,
  });
export function Dashboard() {
  const { user } = useSession();
  const reviews = useReviews();
  const analytics = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api("/analytics"),
  });
  const a = analytics.data;
  return (
    <>
      <PageTitle
        eyebrow="YOUR CODE, IN FOCUS"
        title={`Welcome back, ${user?.name.split(" ")[0]}.`}
        description="A little more insight. A lot more confidence in your next release."
        action={
          <Link className="button primary" to="/app/new">
            <Plus size={17} />
            New review
          </Link>
        }
      />
      <div className="overview-banner">
        <div className="banner-icon">
          <Sparkles size={25} />
        </div>
        <div>
          <Badge tone="violet">YOUR WORKSPACE</Badge>
          <h2>Better code starts with a second look.</h2>
          <p>
            Find the risks, understand the context, and make your next change
            with confidence.
          </p>
          <Link to="/app/new">
            Review your code <ArrowRight size={16} />
          </Link>
        </div>
        <div className="code-orbit" aria-hidden="true">
          <div>{"{ }"}</div>
          <span className="orbit-dot one">
            <ShieldCheck size={19} />
          </span>
          <span className="orbit-dot two">
            <GitBranch size={19} />
          </span>
          <span className="orbit-dot three">
            <Check size={19} />
          </span>
        </div>
      </div>
      <ErrorBox error={analytics.error} />
      <div className="stat-grid">
        {[
          [
            ScanLine,
            "Total reviews",
            a?.reviews ?? "—",
            "Across your workspace",
            "violet",
          ],
          [
            FileCode2,
            "Open findings",
            a?.findings ?? "—",
            "From completed reviews",
            "amber",
          ],
          [
            ShieldCheck,
            "Security hotspots",
            a?.security ?? "—",
            "Awaiting human assessment",
            "red",
          ],
          [
            Activity,
            "Quality score",
            a?.score == null ? "—" : `${a.score}/100`,
            "Based on open findings",
            "green",
          ],
        ].map(([Icon, label, value, desc, tone]: any) => (
          <article className="stat-card" key={label}>
            <div>
              <span>{label}</span>
              <Icon className={`ink-${tone}`} size={18} />
            </div>
            <strong>{value}</strong>
            <p>
              <span className={`mini-dot ${tone}`} />
              {desc}
            </p>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Recent reviews</h2>
              <p>Your latest code, seen from a new angle.</p>
            </div>
            <Link className="text-link" to="/app/history">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <ReviewTable
            reviews={reviews.data?.slice(0, 5)}
            loading={reviews.isLoading}
            error={reviews.error}
          />
        </section>
        <section className="panel quick-start">
          <div className="section-heading">
            <div>
              <h2>Start something good</h2>
              <p>Choose how to bring your code in.</p>
            </div>
            <Sparkles size={18} />
          </div>
          {[
            [
              FileCode2,
              "Review a snippet",
              "Paste code or upload source files",
              "/app/new",
            ],
            [
              FolderGit2,
              "Explore a repository",
              "Import a source ZIP or public GitHub repo",
              "/app/new?mode=github",
            ],
            [
              GitPullRequest,
              "Review a pull request",
              "Focus on the files that changed",
              "/app/pulls",
            ],
          ].map(([Icon, t, d, to]: any) => (
            <Link className="quick-action" key={t} to={to}>
              <span>
                <Icon size={20} />
              </span>
              <div>
                <strong>{t}</strong>
                <p>{d}</p>
              </div>
              <ArrowUpRight size={15} />
            </Link>
          ))}
          <div className="privacy-note">
            <LockKeyhole size={16} />
            <p>
              You're in control. Nothing is pushed to your repository from this
              workspace.
            </p>
          </div>
        </section>
      </div>
      <div className="dashboard-grid bottom-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Quality over time</h2>
              <p>Actual scores from your completed reviews.</p>
            </div>
            <Badge>Last 20 reviews</Badge>
          </div>
          {a?.trends?.length ? (
            <QualityChart data={a.trends} />
          ) : (
            <div className="chart-empty">
              <div className="chart-grid" />
              <Activity size={23} />
              <strong>Your progress starts here</strong>
              <p>Complete a review to see your quality trend.</p>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>A thoughtful review process</h2>
              <p>From first look to a confident change.</p>
            </div>
          </div>
          <div className="steps">
            {[
              [
                "01",
                "Analyze with evidence",
                "Findings point back to exact source lines.",
              ],
              [
                "02",
                "Understand the context",
                "Explore symbols, imports, and AI explanations.",
              ],
              [
                "03",
                "Review before applying",
                "Preview every patch and approve each change.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <section>
                  <strong>{t}</strong>
                  <p>{d}</p>
                </section>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
function QualityChart({ data }: { data: any[] }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 16, bottom: 0, left: -25 }}
        >
          <defs>
            <linearGradient id="qualityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b7cf8" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#8b7cf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "#8993a8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#8993a8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#9386ff"
            strokeWidth={2}
            fill="url(#qualityFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ReviewTable({
  reviews,
  loading,
  error,
}: {
  reviews?: Summary[];
  loading?: boolean;
  error?: unknown;
}) {
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!reviews?.length)
    return (
      <Empty title="Your first insight is one review away." to="/app/new">
        Bring a snippet or repository. We'll help you see what matters.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Review</th>
            <th>Status</th>
            <th>Findings</th>
            <th>Score</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {reviews.map((r) => (
            <tr key={r.id}>
              <td>
                <Link className="review-name" to={`/app/reviews/${r.id}`}>
                  <span className="file-icon">
                    <FileCode2 size={18} />
                  </span>
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {r.fileCount} files · {r.source}
                    </small>
                  </span>
                </Link>
              </td>
              <td>
                <Badge
                  tone={
                    r.status === "completed"
                      ? "green"
                      : r.status === "failed"
                        ? "red"
                        : "violet"
                  }
                >
                  {r.status}
                </Badge>
              </td>
              <td>{r.findings.length}</td>
              <td>
                <span
                  className={
                    r.score != null && r.score >= 80 ? "ink-green" : "ink-amber"
                  }
                >
                  {r.score ?? "—"}
                </span>
              </td>
              <td className="muted">{date(r.createdAt)}</td>
              <td>
                <Link aria-label={`Open ${r.name}`} to={`/app/reviews/${r.id}`}>
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ReviewList() {
  const reviews = useReviews();
  const [search, setSearch] = useState("");
  return (
    <>
      <PageTitle
        title="Review history"
        description="Every review, every finding, every step forward."
        action={
          <Link className="button primary" to="/app/new">
            <Plus size={16} />
            New review
          </Link>
        }
      />
      <section className="panel">
        <div className="toolbar">
          <div className="input-icon">
            <Search size={16} />
            <input
              aria-label="Search reviews"
              placeholder="Search your reviews…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge>{reviews.data?.length || 0} reviews</Badge>
        </div>
        <ReviewTable
          reviews={reviews.data?.filter((r) =>
            r.name.toLowerCase().includes(search.toLowerCase()),
          )}
          loading={reviews.isLoading}
          error={reviews.error}
        />
      </section>
    </>
  );
}
export function Projects() {
  const teams=useQuery({queryKey:['teams'],queryFn:()=>api<any[]>('/teams')});
  const q = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/projects"),
  });
  const reviews = useReviews();
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: (data: Record<string, FormDataEntryValue>) =>
      post("/projects", data),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["projects"] });
      void client.invalidateQueries({ queryKey: ["analytics"] });
      setOpen(false);
    },
  });
  return (
    <>
      <PageTitle
        title="Projects"
        description="Give every repository a place to grow."
        action={
          <button className="primary" onClick={() => setOpen(true)}>
            <Plus size={16} />
            New project
          </button>
        }
      />
      <ErrorBox error={q.error} />
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <section className="panel">
          <Empty title="A home for your code">
            Create a project to organize related code reviews.
          </Empty>
          <div className="center-action">
            <button className="primary" onClick={() => setOpen(true)}>
              Create your first project
            </button>
          </div>
        </section>
      ) : (
        <div className="project-grid">
          {q.data.map((p) => {
            const count =
              reviews.data?.filter((r) => r.projectId === p.id).length || 0;
            return (
              <article className="panel project-card" key={p.id}>
                <div className="section-heading">
                  <span className="empty-icon">
                    <FolderGit2 size={22} />
                  </span>
                  <Badge>{p.teamId?'Team project':'Private'}</Badge>
                </div>
                <h2>{p.name}</h2>
                <p>{p.description || "A fresh perspective on your code."}</p>
                <div className="project-meta">
                  <span>{count} reviews</span>
                  <span>Created {date(p.createdAt)}</span>
                </div>
                <Link className="button" to={`/app/new?project=${p.id}`}>
                  Review code <ArrowUpRight size={15} />
                </Link>
                {reviews.data
                  ?.filter((r) => r.projectId === p.id)
                  .slice(0, 3)
                  .map((r) => (
                    <Link
                      key={r.id}
                      className="project-review"
                      to={`/app/reviews/${r.id}`}
                    >
                      {r.name}
                      <ArrowRight size={14} />
                    </Link>
                  ))}
              </article>
            );
          })}
        </div>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Create a project"
        description="Organize related reviews in one place."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(Object.fromEntries(new FormData(e.currentTarget)));
          }}
        >
          <label>
            Project name
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="My application"
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              maxLength={500}
              placeholder="What are you building?"
            />
          </label>
          <label>Visibility<select name="teamId"><option value="">Private — only me</option>{teams.data?.map(t=><option key={t.id} value={t.id}>{t.name} — team members</option>)}</select></label><ErrorBox error={create.error} />
          <button className="primary" disabled={create.isPending}>
            Create project
          </button>
        </form>
      </Modal>
    </>
  );
}
export function Findings({ security = false }: { security?: boolean }) {
  const q = useReviews();
  const [severity, setSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("open");
  const findings =
    q.data
      ?.flatMap((r) =>
        r.findings.map((f) => ({ ...f, reviewId: r.id, reviewName: r.name })),
      )
      .filter(
        (f) =>
          (!security || f.category === "security") &&
          (severity === "all" || f.severity === severity) &&
          (status === "all" || f.status === status) &&
          `${f.title} ${f.file}`.toLowerCase().includes(search.toLowerCase()),
      ) || [];
  return (
    <>
      <PageTitle
        title={security ? "Security center" : "Findings"}
        description={
          security
            ? "Trace security hotspots to their source. Confirm reachability before treating them as vulnerabilities."
            : "The details that make your next change better."
        }
      />
      <section className="panel">
        <div className="toolbar">
          <div className="input-icon">
            <Search size={16} />
            <input
              aria-label="Search findings"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search findings or files…"
            />
          </div>
          <select
            aria-label="Severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            {["all", "critical", "high", "medium", "low"].map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All severities" : s}
              </option>
            ))}
          </select>
          <select
            aria-label="Finding status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["open", "dismissed", "resolved", "all"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <ErrorBox error={q.error} />
        {q.isLoading ? (
          <Loading />
        ) : !findings.length ? (
          <Empty title="Nothing to show here yet" to="/app/new">
            Run a review or adjust your filters to explore findings.
          </Empty>
        ) : (
          findings.map((f) => (
            <Link
              className="finding-list-row"
              key={f.id}
              to={`/app/reviews/${f.reviewId}?finding=${f.id}`}
            >
              <span className={`severity-mark ${f.severity}`} />
              <div>
                <div>
                  <strong>{f.title}</strong>
                  <Badge
                    tone={
                      f.severity === "high" || f.severity === "critical"
                        ? "red"
                        : "amber"
                    }
                  >
                    {f.severity}
                  </Badge>
                  <Badge>{f.verification}</Badge>
                </div>
                <p>
                  <code>
                    {f.file}:{f.startLine}
                  </code>{" "}
                  · {f.reviewName}
                </p>
              </div>
              <ArrowUpRight size={16} />
            </Link>
          ))
        )}
      </section>
    </>
  );
}
export function Analytics() {
  const q = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api("/analytics"),
  });
  const a = q.data;
  return (
    <>
      <PageTitle
        title="Quality analytics"
        description="Real review data. A transparent way to measure progress."
      />
      <ErrorBox error={q.error} />
      {q.isLoading ? (
        <Loading />
      ) : (
        a && (
          <>
            <div className="stat-grid">
              {[
                ["Completed + pending", a.reviews],
                ["Open findings", a.findings],
                ["High / critical", a.critical],
                ["Average score", a.score ?? "—"],
              ].map(([name, value]) => (
                <div className="stat-card" key={name}>
                  <span>{name}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <h2>Quality trend</h2>
                {a.trends.length ? (
                  <QualityChart data={a.trends} />
                ) : (
                  <Empty title="No completed reviews">
                    Your quality trend appears after your first analysis.
                  </Empty>
                )}
              </section>
              <section className="panel">
                <h2>Language distribution</h2>
                <p className="muted">Lines of source across review snapshots</p>
                {Object.keys(a.languages).length ? (
                  Object.entries(a.languages).map(([lang, count]: any) => (
                    <div className="language-row" key={lang}>
                      <div>
                        <span>{lang}</span>
                        <span>{count.toLocaleString()} lines</span>
                      </div>
                      <progress
                        max={Math.max(
                          ...(Object.values(a.languages) as number[]),
                        )}
                        value={count}
                      />
                    </div>
                  ))
                ) : (
                  <Empty title="No source indexed">
                    Analyze code to see language coverage.
                  </Empty>
                )}
              </section>
            </div>
            <section className="panel methodology">
              <ShieldCheck size={22} />
              <div>
                <h3>How the score works</h3>
                <p>{a.methodology}</p>
                <p className="muted">
                  Technical debt estimates, duplication percentages, and
                  reliability grades are not generated without the analyzers
                  needed to support them.
                </p>
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
export function SettingsPage() {
  const q = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => api("/capabilities"),
  });
  const { user, token, set } = useSession();
  const [notice, setNotice] = useState("");
  const update = useMutation({
    mutationFn: (name: string) =>
      api("/me", { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: (result) => {
      set(token, result);
      setNotice("Profile updated");
    },
  });
  return (
    <>
      <PageTitle
        title="Settings"
        description="Make this workspace yours. Keep your integrations intentional."
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>Profile</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate(String(new FormData(e.currentTarget).get("name")));
            }}
          >
            <label>
              Display name
              <input
                name="name"
                defaultValue={user?.name}
                minLength={2}
                required
              />
            </label>
            <label>
              Email address
              <input value={user?.email || ""} readOnly />
            </label>
            <ErrorBox error={update.error} />
            {notice && (
              <p className="ink-green" role="status">
                {notice}
              </p>
            )}
            <button className="primary" disabled={update.isPending}>
              Save changes
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Integrations & capabilities</h2>
          <ErrorBox error={q.error} />
          {q.data && (
            <>
              <div className="setting-row">
                <span>
                  <Sparkles size={18} />
                  Gemini AI
                </span>
                <Badge tone={q.data.gemini ? "green" : "amber"}>
                  {q.data.gemini ? "Configured" : "Setup required"}
                </Badge>
              </div>
              <p className="muted">
                Set GEMINI_API_KEY and GEMINI_MODEL on your server. Never put
                credentials in browser code. Source context is sent to Google
                only when you request AI analysis.
              </p>
              <GitHubConnection/>
              <div className="setting-row">
                <span>Persistence</span>
                <Badge>{q.data.persistence}</Badge>
              </div>
              <div className="setting-row">
                <span>Background jobs</span>
                <Badge>{q.data.queue}</Badge>
              </div>
              <div className="setting-row">
                <span>Analysis engines</span>
                <Badge>{q.data.analyzers.join(" · ")}</Badge>
              </div>
            </>
          )}
        </section>
      </div>
      <section className="panel methodology">
        <LockKeyhole size={22} />
        <div>
          <h3>Your code stays under your control</h3>
          <p>
            Uploaded code is analyzed as text. Patches modify isolated review
            snapshots. Test execution and external analyzer workers require
            additional setup; no source code is executed by the API.
          </p>
        </div>
      </section>
    </>
  );
}
export function AssistantPage() {
  const q = useReviews();
  return (
    <>
      <PageTitle
        title="AI assistant"
        description="Start a conversation with the context that matters."
      />
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Choose a review to explore</h2>
            <p>
              The assistant retrieves relevant source from your selected review.
            </p>
          </div>
          <Sparkles size={20} />
        </div>
        <ReviewTable reviews={q.data} loading={q.isLoading} error={q.error} />
      </section>
    </>
  );
}
export function GitHubPage() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [pulls, setPulls] = useState<any[] | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <PageTitle
        title="Pull requests"
        description="Bring changed files into focus before they land."
      />
      <section className="panel github-connect">
        <div className="empty-icon">
          <GitPullRequest size={26} />
        </div>
        <h2>Explore a public repository</h2>
        <p className="muted">
          Fetch open pull requests and review their changed source files.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            try {
              setPulls(
                await api(
                  `/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
                ),
              );
            } catch (err) {
              setError(err);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              Owner
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                required
                placeholder="organization"
                pattern="[\w.\-]+"
              />
            </label>
            <label>
              Repository
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                required
                placeholder="repository"
                pattern="[\w.\-]+"
              />
            </label>
          </div>
          <ErrorBox error={error} />
          <button className="primary" disabled={busy}>
            {busy ? "Fetching…" : "Find pull requests"}
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
      {pulls && (
        <section className="panel">
          {!pulls.length ? (
            <Empty title="No open pull requests">
              This repository has no open pull requests.
            </Empty>
          ) : (
            pulls.map((p) => (
              <div className="pull-row" key={p.number}>
                <GitPullRequest className="ink-green" size={21} />
                <div>
                  <strong>{p.title}</strong>
                  <p className="muted">
                    #{p.number} · {p.user.login} · {p.head.ref}
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await post("/github/review", {
                        owner,
                        repo,
                        pull: p.number,
                      });
                      navigate(`/app/reviews/${r.id}`);
                    } catch (err) {
                      setError(err);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Review files <ArrowUpRight size={15} />
                </button>
              </div>
            ))
          )}
        </section>
      )}
    </>
  );
}
export function TeamPage() { return <TeamManagement/>; }
export function UsagePage() {
  const q = useQuery({ queryKey: ["usage"], queryFn: () => api("/usage") });
  return (
    <>
      <PageTitle
        title="Usage & billing"
        description="A clear view of how you use your workspace."
      />
      <ErrorBox error={q.error} />
      {q.data && (
        <section className="panel usage-card">
          <Badge tone="violet">{q.data.plan}</Badge>
          <h2>
            {q.data.today} <span className="muted">/ {q.data.dailyLimit}</span>
          </h2>
          <p>Reviews submitted today (UTC)</p>
          <progress value={q.data.today} max={q.data.dailyLimit} />
          <p className="muted">
            {q.data.total} reviews submitted in total. No paid subscription or
            payment collection is enabled.
          </p>
        </section>
      )}
    </>
  );
}
export function AdminPage() {
  const q = useQuery({
    queryKey: ["admin"],
    queryFn: () => api("/admin"),
    retry: false,
  });
  return (
    <>
      <PageTitle
        title="Admin console"
        description="Restricted platform administration."
      />
      <ErrorBox error={q.error} />
      {q.data && (
        <section className="panel">
          <h2>
            {q.data.users.length} accounts · {q.data.reviews} reviews
          </h2>
          {q.data.users.map((u: any) => (
            <div className="setting-row" key={u.id}>
              <span>{u.email}</span>
              <Badge>{u.role}</Badge>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
