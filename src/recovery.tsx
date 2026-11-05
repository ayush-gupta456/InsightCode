import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { post } from "./api";
import { ErrorBox, Logo } from "./ui";
import { ThemeControl } from "./theme";
export function Recovery() {
  const [params] = useSearchParams();
  const reset = location.pathname === "/reset-password";
  const [token] = useState(
    () =>
      new URLSearchParams(location.hash.slice(1)).get("token") ||
      params.get("token") ||
      "",
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>();
  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Link to="/">
          <Logo />
        </Link>
        <ThemeControl />
      </div>
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="empty-icon">
          <Mail size={24} />
        </div>
        <h1>{reset ? "Choose a new password" : "Forgot your password?"}</h1>
        <p className="muted">
          {reset
            ? "Use a strong, unique password for your workspace."
            : "Enter your account email and we’ll send a secure reset link."}
        </p>
        {done ? (
          <div role="status" className="auth-success">
            <ShieldCheck size={22} />
            <p>
              {reset
                ? "Your password has been updated. Sign in with your new password."
                : "If an account exists for this address, a reset link will arrive shortly. It expires in 30 minutes."}
            </p>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(undefined);
              setBusy(true);
              const data = Object.fromEntries(new FormData(e.currentTarget));
              try {
                if (reset && data.password !== data.confirm)
                  throw new Error("Passwords do not match");
                await post(
                  `/auth/${reset ? "reset-password" : "forgot-password"}`,
                  reset
                    ? { token, password: data.password }
                    : { email: data.email },
                );
                setDone(true);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {reset ? (
              <>
                <label>
                  New password
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    maxLength={72}
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  Confirm password
                  <input
                    name="confirm"
                    type="password"
                    required
                    minLength={12}
                    maxLength={72}
                    autoComplete="new-password"
                  />
                </label>
              </>
            ) : (
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
            )}
            <ErrorBox error={error} />
            <button className="primary" disabled={busy || (reset && !token)}>
              {busy
                ? "Please wait…"
                : reset
                  ? "Reset password"
                  : "Send reset link"}
            </button>
            {reset && !token && (
              <p role="alert">
                This link is missing its reset token. Request a new link.
              </p>
            )}
          </form>
        )}
        <Link className="auth-back" to="/login">
          <ArrowLeft size={15} />
          Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
