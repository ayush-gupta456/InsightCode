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
  Settings,
  Users,
  Search,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  LogOut,
  Command,
  ArrowUpRight,
  Check,
  Code2,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion } from "motion/react";
import { AuthStory } from "./auth-story";
import { AnimatedIcon } from "./motion-ui";
const Landing = lazy(() => import("./Landing"));
import { AppErrorBoundary, ErrorScreen, LoadingScreen } from "./status";
import { ThemeControl } from "./theme";
import { Recovery } from "./recovery";
import { api, post, refreshSession, useSession } from "./api";
import { Badge, ErrorBox, Logo, Modal } from "./ui";
const Dashboard = lazy(() => import("./pages").then(m => ({default: m.Dashboard})));
const Projects = lazy(() => import("./pages").then(m => ({default: m.Projects})));
const ReviewList = lazy(() => import("./pages").then(m => ({default: m.ReviewList})));
const Findings = lazy(() => import("./pages").then(m => ({default: m.Findings})));
const Analytics = lazy(() => import("./pages").then(m => ({default: m.Analytics})));
const SettingsPage = lazy(() => import("./pages").then(m => ({default: m.SettingsPage})));
const AssistantPage = lazy(() => import("./pages").then(m => ({default: m.AssistantPage})));
const GitHubPage = lazy(() => import("./pages").then(m => ({default: m.GitHubPage})));
const TeamPage = lazy(() => import("./pages").then(m => ({default: m.TeamPage})));
const UsagePage = lazy(() => import("./pages").then(m => ({default: m.UsagePage})));
const AdminPage = lazy(() => import("./pages").then(m => ({default: m.AdminPage})));
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
      ["Quality analytics", "/app/analytics", ChartNoAxesCombined],
    ],
  },
  {
    label: "Workspace",
    items: [
      ["Review history", "/app/history", History],
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
      <Route path="/forgot-password" element={<Recovery />} />
      <Route path="/reset-password" element={<Recovery />} />
      <Route path="/app" element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="new" element={<NewReview />} />
        <Route path="reviews/:id" element={<ReviewWorkspace />} />
        <Route path="findings" element={<Findings />} />
        <Route path="security" element={<Navigate to="/app/findings?category=security" replace />} />
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
          <ErrorScreen notFound />
        }
      />
    </Routes>
  );
}
function Shell() {
  const { user, token, ready } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [command, setCommand] = useState(false);
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  const [actionError, setActionError] = useState<unknown>();
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
    refetchInterval: 120_000,
  });
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
  if (!ready) return <LoadingScreen/>;
  if (!user) return <Navigate to="/login" replace />;
  const current =
    nav
      .flatMap((n) => n.items)
      .find(([, path]) => location.pathname === path)?.[0] ||
    "Review workspace";
  const unread = notes.data?.filter((n) => !n.read).length || 0;
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <a className="skip-link" href="#workspace-content">Skip to content</a>
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
        <nav aria-label="Main navigation">
          {nav.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map(([label, path, Icon]) => (
                <NavLink title={label} aria-label={label} key={path} end to={path}>
                  <AnimatedIcon icon={Icon} size={18} />
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
              Reviews follow your project permissions.
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
              aria-expanded={matchMedia("(max-width: 760px)").matches ? mobileMenu : !collapsed}
              onClick={() => matchMedia('(max-width: 760px)').matches ? setMobileMenu(true) : setCollapsed(!collapsed)}
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
            <button className="search-trigger" aria-label="Find pages and reviews" onClick={() => setCommand(true)}>
              <Search size={15} />
              <span>Find pages and reviews</span>
              <kbd>Ctrl K</kbd>
            </button>
            <ThemeControl />
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
        <main className="page" id="workspace-content" tabIndex={-1}>
          <motion.div key={location.pathname} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:.18,ease:"easeOut"}}><AppErrorBoundary key={location.pathname}><Suspense fallback={<LoadingScreen compact label="Loading this view"/>}><Outlet /></Suspense></AppErrorBoundary></motion.div>
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
      <Modal open={mobileMenu} onOpenChange={setMobileMenu} title="Workspace navigation" className="mobile-navigation">
        <nav aria-label="Workspace pages">{nav.map(group=><section key={group.label}><h3>{group.label}</h3>{group.items.map(([label,path,Icon])=><NavLink key={path} end to={path} onClick={()=>setMobileMenu(false)}><Icon size={20}/>{label}</NavLink>)}</section>)}</nav>
        <button className="button" onClick={()=>{setMobileMenu(false);setProfile(true);}}>Account options</button>
      </Modal>
      <Modal
        open={command}
        onOpenChange={setCommand}
        title="Search your workspace"
        description="Find a page or review. Ctrl+K opens this search."
      >
        <input
          aria-label="Search pages and reviews"
          autoFocus
          placeholder="Search reviews and pages."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ErrorBox error={reviews.error} />
        <div className="command-results">
          {!reviews.isLoading && !reviews.error && search.trim() && !nav.flatMap(n=>n.items).some(([label])=>label.toLowerCase().includes(search.toLowerCase())) && !reviews.data?.some(r=>r.name.toLowerCase().includes(search.toLowerCase())) && <p role="status" className="muted">No matching pages or reviews.</p>}
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
        <ErrorBox error={notes.error || actionError} />
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
              try { setActionError(undefined); await post("/notifications/read");
              void client.invalidateQueries({ queryKey: ["notifications"] }); } catch(error) { setActionError(error); }
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
function Auth({ register = false }: { register?: boolean }) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { user } = useSession();
  const authConfig = useQuery({queryKey:['auth-config'],queryFn:()=>api<{google:boolean;passwordReset:boolean}>('/auth/config')});
  const callbackError = new URLSearchParams(location.search).get('error');
  if (user) return <Navigate to="/app" replace />;
  return (
    <div className="auth-page auth-redesigned">
      <div className="auth-topbar"><Link className="auth-logo" to="/">
        <Logo />
      </Link><ThemeControl /></div>
      <div className="auth-layout"><AuthStory/><motion.div className="auth-card" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.2}}>
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
        {authConfig.data?.google ? <a className="button google-signin" href="/api/auth/google/start">Continue with Google</a> : <button className="google-signin" disabled title="Google sign-in is not configured yet">Google sign-in unavailable</button>}
        <div className="auth-divider"><span>or continue with email</span></div>
        {callbackError && <ErrorBox error={callbackError === 'existing-account' ? 'An account already uses this email. Sign in with your password or use password recovery.' : 'Google sign-in was cancelled or could not be completed. Please try again.'} />}
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
              minLength={register ? 12 : 1}
              maxLength={72}
              required
              autoComplete={register ? "new-password" : "current-password"}
              placeholder={register ? "At least 12 characters" : "Enter your password"}
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
          {!register && <Link className="forgot-link" to="/forgot-password">Forgot password?</Link>}
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
      </motion.div></div>
      <div className="auth-foot">
        <ShieldCheck size={15} /> Your source stays in your workspace unless you
        enable AI analysis.
      </div>
    </div>
  );
}
