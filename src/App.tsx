import { useEffect, useState, lazy, Suspense } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  LayoutDashboard,
  FolderGit2,
  ScanLine,
  ShieldCheck,
  ChartNoAxesCombined,
  History,
  GitPullRequest,
  Sparkles,
  Settings,
  Users,
  CreditCard,
  Search,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ChevronDown,
  LogOut,
  Command,
  ArrowUpRight,
  Check,
  Code2,
  ArrowRight,
  Terminal,
  Sun,
  Moon,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { api, post, refreshSession, useSession } from "./api";
import { Badge, ErrorBox, Logo, Modal } from "./ui";
import {
  Dashboard,
  Projects,
  ReviewList,
  Findings,
  Analytics,
  SettingsPage,
  AssistantPage,
  GitHubPage,
  TeamPage,
  UsagePage,
  AdminPage,
} from "./pages";
const NewReview = lazy(() =>
  import("./review").then((m) => ({ default: m.NewReview })),
);
const ReviewWorkspace = lazy(() =>
  import("./review").then((m) => ({ default: m.ReviewWorkspace })),
);

const nav: { label: string; items: [string, string, LucideIcon][] }[] = [
  {
    label: "Overview",
    items: [
      ["Dashboard", "/app", LayoutDashboard],
      ["Projects", "/app/projects", FolderGit2],
      ["New review", "/app/new", ScanLine],
    ],
  },
  {
    label: "Intelligence",
    items: [
      ["Findings", "/app/findings", Code2],
      ["AI assistant", "/app/assistant", Sparkles],
      ["Security center", "/app/security", ShieldCheck],
      ["Quality analytics", "/app/analytics", ChartNoAxesCombined],
    ],
  },
  {
    label: "Workspace",
    items: [
      ["Review history", "/app/history", History],
      ["Pull requests", "/app/pulls", GitPullRequest],
      ["Team members", "/app/team", Users],
      ["Settings", "/app/settings", Settings],
    ],
  },
];
export default function App() {
  useEffect(() => {
    void refreshSession();
  }, []);
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth register />} />
      <Route path="/app" element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="new" element={<NewReview />} />
        <Route path="reviews/:id" element={<ReviewWorkspace />} />
        <Route path="findings" element={<Findings />} />
        <Route path="security" element={<Findings security />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="history" element={<ReviewList />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="pulls" element={<GitHubPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route
        path="*"
        element={
          <div className="not-found">
            <h1>Page not found</h1>
            <Link to="/app">Return to your workspace</Link>
          </div>
        }
      />
    </Routes>
  );
}
function Shell() {
  const { user, token, ready } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [command, setCommand] = useState(false);
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  const [light, setLight] = useState(localStorage.getItem("theme") === "light");
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const reviews = useQuery({
    queryKey: ["reviews"],
    queryFn: () => api<any[]>("/reviews"),
    enabled: !!user,
  });
  const notes = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<any[]>("/notifications"),
    enabled: !!user,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    localStorage.setItem("theme", light ? "light" : "dark");
  }, [light]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!token) return;
    const socket = io({ auth: { token }, transports: ["polling"] });
    socket.on("review:update", ({ id }: { id: string }) => {
      for (const key of [
        ["reviews"],
        ["review", id],
        ["analytics"],
        ["notifications"],
      ])
        void client.invalidateQueries({ queryKey: key });
    });
    return () => {
      socket.close();
    };
  }, [token, client]);
  if (!ready) return <div className="boot">Opening your workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  const current =
    nav
      .flatMap((n) => n.items)
      .find(([, path]) => location.pathname === path)?.[0] ||
    "Review workspace";
  const unread = notes.data?.filter((n) => !n.read).length || 0;
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <Link to="/app">
          <Logo />
        </Link>
        <button
          className="workspace-select"
          onClick={() => navigate("/app/projects")}
        >
          <span className="avatar violet">{user.name[0].toUpperCase()}</span>
          <span className="nav-copy">
            <strong>Personal workspace</strong>
            <small>Self-hosted plan</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <nav>
          {nav.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map(([label, path, Icon]) => (
                <NavLink title={label} key={path} end to={path}>
                  <Icon size={18} />
                  <span className="nav-copy">{label}</span>
                  {label === "New review" && (
                    <span className="nav-hint">+</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="status-dot" /> Your code, your workspace
            <p>
              Reviews stay private.
              <br />
              You control what happens next.
            </p>
            <Link to="/app/usage">
              View usage <ArrowUpRight size={13} />
            </Link>
          </div>
          <button className="profile" onClick={() => setProfile(true)}>
            <span className="avatar">{user.name[0].toUpperCase()}</span>
            <span className="nav-copy">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button"
              aria-label="Toggle sidebar"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{current}</strong>
          </div>
          <div className="top-actions">
            <button className="search-trigger" onClick={() => setCommand(true)}>
              <Search size={15} />
              <span>Search anything…</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button"
              aria-label="Toggle color theme"
              onClick={() => setLight(!light)}
            >
              {light ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label={`Notifications, ${unread} unread`}
              onClick={() => setNotifications(true)}
            >
              <Bell size={18} />
              {unread > 0 && <i />}
            </button>
            <span className="avatar small">{user.name[0].toUpperCase()}</span>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            <span className="status-dot" /> Private workspace
          </span>
          <span>Built for better code.</span>
          <span>
            InsightCode <span className="muted">v0.1</span>
          </span>
        </footer>
      </div>
      <Modal
        open={command}
        onOpenChange={setCommand}
        title="Search your workspace"
        description="Find a page or review. Ctrl+K opens this search."
      >
        <input
          autoFocus
          placeholder="Search reviews and pages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="command-results">
          {nav
            .flatMap((n) => n.items)
            .filter(([label]) =>
              label.toLowerCase().includes(search.toLowerCase()),
            )
            .map(([label, path, Icon]) => (
              <Link key={path} to={path} onClick={() => setCommand(false)}>
                <Icon size={16} />
                {label}
                <ArrowRight size={14} />
              </Link>
            ))}
          {reviews.data
            ?.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
            .map((r) => (
              <Link
                key={r.id}
                to={`/app/reviews/${r.id}`}
                onClick={() => setCommand(false)}
              >
                <ScanLine size={16} />
                {r.name}
                <Badge>{r.status}</Badge>
              </Link>
            ))}
        </div>
      </Modal>
      <Modal
        open={notifications}
        onOpenChange={setNotifications}
        title="Notifications"
      >
        <ErrorBox error={notes.error} />
        {!notes.data?.length ? (
          <p className="muted">Your review updates will appear here.</p>
        ) : (
          notes.data.map((n) => (
            <Link
              className="notification-row"
              key={n.id}
              to={`/app/reviews/${n.reviewId}`}
              onClick={() => setNotifications(false)}
            >
              <Check size={18} />
              {n.title}
              {!n.read && <span className="status-dot" />}
            </Link>
          ))
        )}
        {unread > 0 && (
          <button
            onClick={async () => {
              await post("/notifications/read");
              void client.invalidateQueries({ queryKey: ["notifications"] });
            }}
          >
            Mark all read
          </button>
        )}
      </Modal>
      <Modal
        open={profile}
        onOpenChange={setProfile}
        title={user.name}
        description={user.email}
      >
        <Link
          className="button"
          to="/app/settings"
          onClick={() => setProfile(false)}
        >
          <Settings size={16} />
          Account settings
        </Link>
        <button
          className="danger-button"
          onClick={async () => {
            await post("/auth/logout");
            useSession.getState().set("", null);
            client.clear();
            navigate("/");
          }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </Modal>
    </div>
  );
}
function Landing() {
  return (
    <div className="landing">
      <header>
        <Link to="/">
          <Logo />
        </Link>
        <div>
          <a href="#workflow">How it works</a>
          <Link to="/login">Sign in</Link>
          <Link className="button primary" to="/register">
            Open your workspace <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <motion.section
        className="landing-hero"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Badge tone="violet">
          <Sparkles size={13} /> A clearer view of your code
        </Badge>
        <h1>
          Ship with confidence.
          <br />
          <span>Understand every change.</span>
        </h1>
        <p>
          Bring your code into focus with evidence-based reviews,
          <br />
          repository insights, and an AI assistant that knows the context.
        </p>
        <div className="hero-buttons">
          <Link className="button primary" to="/register">
            Start your first review <ArrowRight size={17} />
          </Link>
          <a className="button" href="#workflow">
            Explore the workflow
          </a>
        </div>
        <div className="hero-note">
          <ShieldCheck size={15} />
          Private reviews <span>·</span>Approval before changes <span>·</span>No
          remote writes
        </div>
      </motion.section>
      <div className="landing-preview">
        <div className="preview-toolbar">
          <span className="window-dots">● ● ●</span>
          <span>insightcode / your next great idea</span>
          <Badge tone="green">Ready to review</Badge>
        </div>
        <div className="preview-body">
          <div>
            <Terminal size={21} />
            <h3>From source to understanding.</h3>
            <pre>
              <span className="code-purple">const</span> review ={" "}
              <span className="code-purple">await</span> insight.analyze({"{"}
              <br /> source:{" "}
              <span className="code-green">'your-repository'</span>,<br />{" "}
              context: <span className="code-green">'what matters'</span>,<br />{" "}
              confidence:{" "}
              <span className="code-green">'backed by evidence'</span>
              <br />
              {"}"});
            </pre>
          </div>
          <div className="preview-insight">
            <span className="eyebrow">THE REVIEW WORKFLOW</span>
            {[
              ["01", "Inspect", "Explore files, symbols, and dependencies."],
              [
                "02",
                "Understand",
                "Find issues with source evidence and context.",
              ],
              [
                "03",
                "Improve",
                "Preview a patch. Approve it. Review the results.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <section>
                  <strong>{t}</strong>
                  <p>{d}</p>
                </section>
                <Check size={16} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <section id="workflow" className="feature-grid">
        {[
          [
            ScanLine,
            "Start with your code",
            "Paste a snippet, upload source files or a ZIP, or import a public GitHub repository.",
          ],
          [
            ShieldCheck,
            "Evidence comes first",
            "Inspect the exact lines behind each finding. Security hotspots are clearly distinguished from verified issues.",
          ],
          [
            Sparkles,
            "Keep the final say",
            "Connect Gemini for contextual assistance. Review diffs and approve changes to an isolated snapshot.",
          ],
        ].map(([Icon, t, d]: any) => (
          <article key={t}>
            <Icon size={24} />
            <h3>{t}</h3>
            <p>{d}</p>
          </article>
        ))}
      </section>
      <footer>
        <Logo />
        <span>Thoughtful reviews. Better software.</span>
        <Link to="/register">
          Get started <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
function Auth({ register = false }: { register?: boolean }) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { user } = useSession();
  if (user) return <Navigate to="/app" replace />;
  return (
    <div className="auth-page">
      <Link className="auth-logo" to="/">
        <Logo />
      </Link>
      <div className="auth-card">
        <div className="empty-icon">
          <Command size={26} />
        </div>
        <h1>
          {register ? "Your next chapter of better code." : "Welcome back."}
        </h1>
        <p className="muted">
          {register
            ? "Create your private InsightCode workspace."
            : "Pick up where your last review left off."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            const data = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const result = await post(
                `/auth/${register ? "register" : "login"}`,
                data,
              );
              useSession.getState().set(result.token, result.user);
              navigate("/app");
            } catch (err) {
              setError(err);
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <label>
              Your name
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                placeholder="Alex Morgan"
              />
            </label>
          )}
          <label>
            Email address
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
            />
          </label>
          <label htmlFor="auth-password">
            Password
          </label>
          <div className="password-field">
            <input
              id="auth-password"
              name="password"
              type={showPassword ? "text" : "password"}
              minLength={12}
              maxLength={72}
              required
              autoComplete={register ? "new-password" : "current-password"}
              placeholder="At least 12 characters"
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              aria-controls="auth-password"
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <ErrorBox error={error} />
          <button className="primary" disabled={busy}>
            {busy
              ? "Opening workspace…"
              : register
                ? "Create workspace"
                : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already have an account?" : "New to InsightCode?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create a workspace"}
          </Link>
        </p>
      </div>
      <div className="auth-foot">
        <ShieldCheck size={15} /> Your source stays in your workspace unless you
        enable AI analysis.
      </div>
    </div>
  );
}
