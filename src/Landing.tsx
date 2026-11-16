import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  FileCode2,
  GitBranch,
  GitPullRequest,
  Layers3,
  Menu,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Badge, Logo, Modal } from "./ui";
import { ThemeControl } from "./theme";
import { AnimatedIcon, Reveal } from "./motion-ui";

const demoTabs = ["Source", "Finding", "Proposed patch"] as const;
function ReviewDemo() {
  const [active, setActive] = useState(0);
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % demoTabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + demoTabs.length - 1) % demoTabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = demoTabs.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    document.getElementById(`demo-tab-${next}`)?.focus();
  }
  return (
    <section className="review-demo" aria-label="Interactive example review">
      <div className="demo-titlebar">
        <span className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>
          <GitBranch size={14} aria-hidden="true" /> acme / storefront
        </span>
        <Badge>Example review</Badge>
      </div>
      <div className="demo-layout">
        <aside className="demo-filetree" aria-label="Example files">
          <span className="micro-label">SOURCE EXPLORER</span>
          <div>
            <Layers3 size={15} /> storefront
          </div>
          <span className="demo-folder">src / api</span>
          <div className="selected">
            <FileCode2 size={15} /> products.ts{" "}
            <span className="demo-file-dot" />
          </div>
          <div className="muted">
            <FileCode2 size={15} /> client.ts
          </div>
          <div className="muted">
            <FileCode2 size={15} /> types.ts
          </div>
          <div className="demo-tree-note">
            <ShieldCheck size={16} />
            <span>
              Source evidence.
              <br />
              Every finding.
            </span>
          </div>
        </aside>
        <div className="demo-main">
          <div
            className="demo-tabs"
            role="tablist"
            aria-label="Example review stages"
          >
            {demoTabs.map((tab, i) => (
              <button
                key={tab}
                id={`demo-tab-${i}`}
                role="tab"
                aria-selected={active === i}
                aria-controls="demo-panel"
                tabIndex={active === i ? 0 : -1}
                onKeyDown={(e) => moveTab(e, i)}
                onClick={() => setActive(i)}
              >
                {tab}
                {active === i && (
                  <motion.span
                    layoutId="demo-tab-indicator"
                    className="demo-tab-indicator"
                    transition={{ duration: 0.18 }}
                  />
                )}
              </button>
            ))}
          </div>
          <div
            id="demo-panel"
            role="tabpanel"
            aria-labelledby={`demo-tab-${active}`}
            tabIndex={0}
            className="demo-panel"
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                {active === 0 && (
                  <>
                    <div className="demo-file-label">
                      <span>products.ts</span>
                      <span>TypeScript</span>
                    </div>
                    <pre className="demo-code">
                      <code>
                        <span>
                          <i>01</i>
                          <b>export async function</b> getProducts() {"{"}
                        </span>
                        <span>
                          <i>02</i> <b>const</b> response = <b>await</b>{" "}
                          fetch(url);
                        </span>
                        <span className="code-flag">
                          <i>03</i> <b>return</b> response.json();
                        </span>
                        <span>
                          <i>04</i>
                          {"}"}
                        </span>
                      </code>
                    </pre>
                    <div className="demo-evidence">
                      <ScanLine size={18} />
                      <div>
                        <strong>One line. More context.</strong>
                        <p>
                          Explore the finding to see what deserves a closer
                          look.
                        </p>
                      </div>
                    </div>
                  </>
                )}
                {active === 1 && (
                  <div className="demo-finding">
                    <Badge tone="amber">Reliability · Needs review</Badge>
                    <h3>Check the response before reading it.</h3>
                    <p>
                      A failed HTTP response can still resolve this request.
                      Without checking its status, the caller may receive an
                      unexpected error payload.
                    </p>
                    <code>src/api/products.ts:3</code>
                    <div className="demo-evidence">
                      <ShieldCheck size={18} />
                      <span>
                        Inspect the source and assess the finding in context.
                      </span>
                    </div>
                  </div>
                )}
                {active === 2 && (
                  <>
                    <div className="demo-file-label">
                      <span>Proposed diff</span>
                      <Badge tone="green">+3 lines</Badge>
                    </div>
                    <pre className="demo-code">
                      <code>
                        <span> const response = await fetch(url);</span>
                        <span className="code-add">
                          + if (!response.ok) {"{"}
                        </span>
                        <span className="code-add">
                          + throw new Error('Request failed');
                        </span>
                        <span className="code-add">+ {"}"}</span>
                        <span> return response.json();</span>
                      </code>
                    </pre>
                    <div className="demo-evidence">
                      <GitPullRequest size={18} />
                      <span>
                        Review the diff. Changes require your approval.
                      </span>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="demo-status">
            <span>
              <span className="status-dot" />
              Illustrative workflow
            </span>
            <span>No repository connected</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="landing marketing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="marketing-header">
        <Link to="/" aria-label="InsightCode home">
          <Logo />
        </Link>
        <nav className="marketing-nav" aria-label="Main navigation">
          <a href="#workflow">Workflow</a>
          <a href="#capabilities">Capabilities</a>
        </nav>
        <div className="marketing-actions">
          <ThemeControl />
          <Link className="sign-in-link" to="/login">
            Sign in <AnimatedIcon icon={ArrowUpRight} size={15} kind="arrow" />
          </Link>
          <button
            className="icon-button marketing-menu"
            aria-label="Open navigation"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Menu size={21} />
          </button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="marketing-hero">
          <Reveal className="hero-copy">
            <div className="hero-kicker">
              <span className="status-dot" />A sharper perspective on your code
            </div>
            <h1>
              Less uncertainty.
              <br />
              <span>Better software.</span>
            </h1>
            <p>
              Go from source code to a clear next step. Explore your repository,
              understand the risks, and review every change in one focused
              workspace.
            </p>
            <div className="marketing-cta">
              <Link className="button primary" to="/register">
                Start your first review{" "}
                <AnimatedIcon icon={ArrowRight} kind="arrow" size={18} />
              </Link>
              <a className="text-link" href="#review-preview">
                Explore an example <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="hero-assurance">
              <ShieldCheck size={16} aria-hidden="true" />
              Your code. Your context. Your call.
            </div>
          </Reveal>
          <Reveal className="hero-diagram" delay={0.08}>
            <div className="diagram-heading">
              <span className="micro-label">
                A CLEARER PATH TO YOUR NEXT COMMIT
              </span>
              <Code2 size={20} />
            </div>
            <div className="diagram-source">
              <Terminal size={20} />
              <span>
                Bring your code<strong>Files, snippets, or GitHub</strong>
              </span>
              <span className="diagram-tag">01</span>
            </div>
            <div className="diagram-connector" aria-hidden="true" />
            <div className="diagram-center">
              <span className="diagram-icon">
                <ScanLine size={28} />
              </span>
              <div>
                <span className="micro-label">INSIGHTCODE</span>
                <strong>See what matters.</strong>
                <span>Source evidence + repository context</span>
              </div>
            </div>
            <div className="diagram-connector" aria-hidden="true" />
            <div className="diagram-outcomes">
              <span>
                <Check size={17} /> Understand
              </span>
              <span>
                <GitPullRequest size={17} /> Improve
              </span>
            </div>
            <div className="diagram-footnote">
              <span className="status-dot" />
              You approve the next step
            </div>
          </Reveal>
        </section>
        <div className="source-strip">
          <span>ONE WORKSPACE, FROM SOURCE TO DECISION</span>
          <div>
            <span>
              <Code2 size={17} />
              Code snippets
            </span>
            <span>
              <FileCode2 size={17} />
              Source files
            </span>
            <span>
              <Layers3 size={17} />
              ZIP repositories
            </span>
            <span>
              <GitBranch size={17} />
              GitHub imports
            </span>
          </div>
        </div>
        <section id="review-preview" className="marketing-section">
          <Reveal>
            <div className="section-intro">
              <div>
                <span className="eyebrow">CONTEXT, NOT JUST COMMENTS</span>
                <h2>
                  See the code.
                  <br />
                  Understand the change.
                </h2>
              </div>
              <p>
                Keep the source, the finding, and the proposed fix together. Try
                the example below to follow a review from first look to final
                decision.
              </p>
            </div>
            <ReviewDemo />
          </Reveal>
        </section>
        <section id="workflow" className="marketing-section">
          <Reveal>
            <div className="section-intro">
              <div>
                <span className="eyebrow">A DELIBERATE WORKFLOW</span>
                <h2>
                  Three steps.
                  <br />
                  One clear next move.
                </h2>
              </div>
              <p>
                A focused path through the review, with you in control at every
                step.
              </p>
            </div>
          </Reveal>
          <div className="workflow-grid">
            {[
              {
                icon: Code2,
                title: "Bring the context",
                description:
                  "Paste a snippet, upload source files or a ZIP, or import a public GitHub repository.",
              },
              {
                icon: ScanLine,
                title: "Follow the evidence",
                description:
                  "Explore findings alongside source lines, symbols, and dependencies. Assess what matters to your project.",
              },
              {
                icon: GitPullRequest,
                title: "Review the next step",
                description:
                  "Connect Gemini for assistance, inspect proposed diffs, and approve changes to an isolated snapshot.",
              },
            ].map(({ icon, title, description }, i) => (
              <Reveal key={title} delay={i * 0.04}>
                <article className="workflow-card">
                  <div className="workflow-card-top">
                    <AnimatedIcon icon={icon} size={25} />
                    <span>0{i + 1}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
        <section id="capabilities" className="marketing-section">
          <Reveal>
            <div className="section-intro">
              <div>
                <span className="eyebrow">BUILT FOR THE WAY YOU REVIEW</span>
                <h2>
                  The details matter.
                  <br />
                  Keep them in view.
                </h2>
              </div>
            </div>
          </Reveal>
          <div className="capability-grid">
            <Reveal className="capability-wide">
              <article className="capability-card">
                <span className="feature-icon">
                  <AnimatedIcon icon={Layers3} size={25} />
                </span>
                <h3>A workspace that connects the dots.</h3>
                <p>
                  Move between files, findings, and repository context without
                  losing your place. Keep projects and review history organized
                  as your code evolves.
                </p>
                <div className="mini-file-map" aria-hidden="true">
                  <span>
                    <FileCode2 size={16} />
                    Source
                  </span>
                  <span className="map-line" />
                  <span>
                    <ScanLine size={16} />
                    Findings
                  </span>
                  <span className="map-line" />
                  <span>
                    <GitBranch size={16} />
                    Context
                  </span>
                </div>
              </article>
            </Reveal>
            <Reveal>
              <article className="capability-card">
                <span className="feature-icon">
                  <AnimatedIcon icon={ShieldCheck} size={25} />
                </span>
                <h3>Evidence before assumptions.</h3>
                <p>
                  Findings point to source lines. Security hotspots remain
                  clearly marked for human assessment.
                </p>
                <Badge tone="green">
                  <Check size={13} /> Human judgment stays central
                </Badge>
              </article>
            </Reveal>
            <Reveal>
              <article className="capability-card">
                <span className="feature-icon">
                  <AnimatedIcon icon={Sparkles} size={25} kind="turn" />
                </span>
                <h3>AI, with the context.</h3>
                <p>
                  Enable Gemini when you need explanations or proposed fixes.
                  Review what it suggests before applying a change.
                </p>
                <span className="feature-footnote">
                  Optional · Bring your API key
                </span>
              </article>
            </Reveal>
            <Reveal className="capability-wide">
              <article className="capability-card">
                <span className="feature-icon">
                  <AnimatedIcon icon={GitPullRequest} size={25} />
                </span>
                <h3>Your repository. Your decisions.</h3>
                <p>
                  Inspect changes in an isolated review snapshot. Publishing to
                  GitHub is a separate, explicit action that you control.
                </p>
                <div className="approval-flow">
                  <span>
                    <Check size={15} /> Inspect diff
                  </span>
                  <ArrowRight size={16} />
                  <span>
                    <Check size={15} /> Approve change
                  </span>
                </div>
              </article>
            </Reveal>
          </div>
        </section>
        <Reveal>
          <section className="closing-cta">
            <span className="eyebrow">MAKE YOUR NEXT CHANGE A CLEARER ONE</span>
            <h2>
              Good code starts
              <br />
              with a closer look.
            </h2>
            <Link className="button primary" to="/register">
              Open your workspace{" "}
              <AnimatedIcon icon={ArrowRight} size={18} kind="arrow" />
            </Link>
            <p>Start with the code you already have.</p>
          </section>
        </Reveal>
      </main>
      <footer className="marketing-footer">
        <Logo />
        <span>Thoughtful reviews. Better software.</span>
        <a
          href="https://github.com/ayush-gupta456/InsightCode"
          target="_blank"
          rel="noreferrer"
        >
          View source <ArrowUpRight size={15} />
        </a>
      </footer>
      <Modal
        open={menu}
        onOpenChange={setMenu}
        title="Explore InsightCode"
        className="public-navigation"
      >
        <nav aria-label="Mobile navigation">
          <a href="#workflow" onClick={() => setMenu(false)}>
            Workflow
          </a>
          <a href="#capabilities" onClick={() => setMenu(false)}>
            Capabilities
          </a>
          <Link to="/login" onClick={() => setMenu(false)}>
            Sign in
          </Link>
          <Link className="button primary" to="/register">
            Open your workspace <ArrowRight size={16} />
          </Link>
        </nav>
      </Modal>
    </div>
  );
}
