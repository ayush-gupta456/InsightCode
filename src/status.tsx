import { Component, type ErrorInfo, type ReactNode } from "react";
import { motion } from "motion/react";
import { Code2, ArrowLeft, RotateCcw, TriangleAlert } from "lucide-react";

export function LoadingScreen({ compact = false, label = "Opening your workspace" }: { compact?: boolean; label?: string }) {
  return <section className={`status-screen ${compact ? "status-inline" : ""}`} role="status" aria-live="polite" aria-busy="true">
    <div className="status-art" aria-hidden="true"><span className="status-orbit"/><span className="status-mark"><Code2 size={32}/></span></div>
    <span className="status-brand">InsightCode</span>
    <h2>{label}</h2><p>Your next clear view of the code is on its way.</p>
    <div className="status-progress" aria-hidden="true"><span/></div>
  </section>;
}

export function ErrorScreen({ notFound = false }: { notFound?: boolean }) {
  return <motion.section className="status-screen status-error" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.2}} aria-labelledby="error-heading">
    <div className="status-art" aria-hidden="true"><span className="status-mark"><TriangleAlert size={32}/></span></div>
    <span className="status-brand">{notFound ? "404 / Page not found" : "InsightCode / Something went wrong"}</span>
    <h1 id="error-heading">{notFound ? "This path needs a new direction." : "Let's get you back to your code."}</h1>
    <p>{notFound ? "The page may have moved, or the link may be incomplete. Return home to open your workspace." : "We couldn't display this page. Try loading it again. If the problem continues, return home and reopen your workspace."}</p>
    <div className="status-actions">{!notFound && <button className="primary" onClick={()=>window.location.reload()}><RotateCcw size={16}/>Reload page</button>}<a className="button" href="/"><ArrowLeft size={16}/>Back to home</a></div>
  </motion.section>;
}

export class AppErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch(error:Error, info:ErrorInfo) { console.error("InsightCode page failed",error,info.componentStack); }
  render() { return this.state.failed ? <ErrorScreen/> : this.props.children; }
}
