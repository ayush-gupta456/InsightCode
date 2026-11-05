import type { Express, Response, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Store } from "./store.js";
import type { User } from "../shared/types.js";
import { HttpError, hashToken, randomToken } from "./security.js";
import nodemailer from "nodemailer";
import {gmailReady,sendGmailReset} from './gmail-mail.js';
export function smtpOptions(env = process.env) {
  const port = Number(env.SMTP_PORT || 587);
  if (
    !env.SMTP_HOST ||
    !env.SMTP_USER ||
    !env.SMTP_PASS ||
    env.SMTP_PASS === "YOUR_16_CHARACTER_APP_PASSWORD" ||
    !Number.isInteger(port) ||
    ![465, 587].includes(port)
  )
    return undefined;
  return {
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const password = z
  .string()
  .min(12)
  .max(72)
  .refine(
    (v) => Buffer.byteLength(v) <= 72,
    "Password must fit within 72 UTF-8 bytes",
  );
export async function deliverReset(email: string, url: string) {
  if(process.env.AUTH_EMAIL_PROVIDER==='gmail' || gmailReady()) {
    await sendGmailReset(email,url);
    return;
  }
  const smtp = smtpOptions();
  if (smtp) {
    const transport = nodemailer.createTransport(smtp);
    try {
      await transport.sendMail({
        from: process.env.AUTH_EMAIL_FROM,
        to: email,
        subject: "Reset your InsightCode password",
        text: `Use this link to reset your password within 30 minutes:\n\n${url}\n\nIf you did not request this, ignore this email.`,
      });
    } finally {
      transport.close();
    }
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: [email],
      subject: "Reset your InsightCode password",
      text: `Use this link to reset your password within 30 minutes:\n\n${url}\n\nIf you did not request this, ignore this email.`,
    }),
  });
  if (!response.ok)
    throw new HttpError(
      503,
      "Password reset email could not be sent. Please try again later",
    );
}
export function mountAccountRecovery(
  app: Express,
  store: Store,
  limit: RequestHandler,
  issueSession: (user: User, res: Response) => Promise<unknown>,
  locked: <T>(key: string, fn: () => Promise<T>) => Promise<T>,
  send = deliverReset,
) {
  const origin = () =>
    new URL(process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173").origin;
  const googleReady = () =>
    !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const mailReady = () =>
    process.env.AUTH_EMAIL_PROVIDER==='gmail' ? gmailReady() : !!(
      process.env.AUTH_EMAIL_FROM &&
      (gmailReady() || smtpOptions() || process.env.RESEND_API_KEY)
    );
  app.get("/api/auth/config", (_req, res) =>
    res.json({ google: googleReady(), passwordReset: mailReady() }),
  );
  app.post("/api/auth/forgot-password", limit, async (req, res) => {
    const { email } = z
      .object({
        email: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
      })
      .parse(req.body);
    if (!mailReady())
      throw new HttpError(
        503,
        "Password recovery is not available yet. Please contact the workspace administrator",
      );
    const user = (await store.list("users")).find((u) => u.email === email);
    if (user) {
      const raw = randomToken(),
        id = hashToken(raw);
      await store.put("passwordResets", {
        id,
        ownerId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        version: user.authVersion || 0,
      });
      try {
        await send(email, `${origin()}/reset-password#token=${raw}`);
      } catch {
        await store.remove("passwordResets", id);
        throw new HttpError(
          503,
          "Password reset email could not be sent. Please try again later",
        );
      }
    }
    res.json({ ok: true });
  });
  app.post("/api/auth/reset-password", limit, async (req, res) => {
    const input = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/), password })
      .parse(req.body);
    await locked("auth-accounts", async () => {
      const id = hashToken(input.token),
        reset = await store.get("passwordResets", id);
      const user = reset ? await store.get("users", reset.ownerId) : undefined;
      if (
        !reset ||
        !user ||
        Date.parse(reset.expiresAt) <= Date.now() ||
        reset.version !== (user.authVersion || 0)
      )
        throw new HttpError(
          400,
          "This reset link is invalid or expired. Request a new link",
        );
      const passwordHash = await bcrypt.hash(input.password, 12);
      if (!(await store.consume("passwordResets", id)))
        throw new HttpError(400, "This reset link has already been used");
      await store.put("users", {
        ...user,
        passwordHash,
        authVersion: (user.authVersion || 0) + 1,
      });
      for (const session of await store.list("sessions", user.id))
        await store.remove("sessions", session.id);
      res.json({ ok: true });
    });
  });
  const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/google",
    maxAge: 600000,
  };
  app.get("/api/auth/google/start", limit, async (_req, res) => {
    if (!googleReady())
      throw new HttpError(503, "Google sign-in is not configured");
    const state = randomToken(),
      binding = randomToken(),
      verifier = randomToken(),
      nonce = randomToken();
    await store.put("googleStates", {
      id: hashToken(state),
      ownerId: "anonymous",
      binding: hashToken(binding),
      verifier,
      nonce,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
    res.cookie("google_state", binding, cookie);
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${origin()}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: Buffer.from(hashToken(verifier), "hex").toString(
        "base64url",
      ),
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });
  app.get("/api/auth/google/callback", limit, async (req, res) => {
    try {
      if (!googleReady()) throw new Error("unconfigured");
      const { state, code } = z
        .object({
          state: z.string().regex(/^[a-f0-9]{64}$/),
          code: z.string().min(1).max(4096),
        })
        .parse(req.query);
      const binding = req.headers.cookie
        ?.split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith("google_state="))
        ?.slice(13);
      const record = await store.get("googleStates", hashToken(state));
      if (
        !record ||
        !binding ||
        record.binding !== hashToken(binding) ||
        Date.parse(record.expiresAt) <= Date.now()
      )
        throw new Error("invalid state");
      if (!(await store.consume("googleStates", record.id)))
        throw new Error("used state");
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${origin()}/api/auth/google/callback`,
          grant_type: "authorization_code",
          code_verifier: record.verifier,
        }),
      });
      if (!response.ok) throw new Error("exchange failed");
      const data = (await response.json()) as { id_token: string };
      const { payload } = await jwtVerify(data.id_token, keys, {
        audience: process.env.GOOGLE_CLIENT_ID,
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        algorithms: ["RS256"],
        requiredClaims: ["sub", "exp", "iat", "nonce", "email"],
      });
      if (
        payload.nonce !== record.nonce ||
        payload.email_verified !== true ||
        !payload.sub ||
        typeof payload.email !== "string"
      )
        throw new Error("claims rejected");
      await locked("auth-accounts", async () => {
        const users = await store.list("users");
        let user = users.find((u) => u.googleId === payload.sub);
        if (!user) {
          const email = payload.email!.toString().toLowerCase();
          if (users.some((u) => u.email === email))
            throw new HttpError(
              409,
              "Use your existing email and password to sign in",
            );
          user = {
            id: randomUUID(),
            email,
            name:
              typeof payload.name === "string"
                ? payload.name.slice(0, 80)
                : email.split("@")[0],
            passwordHash: await bcrypt.hash(randomToken(), 12),
            googleId: payload.sub,
            role: "member",
            createdAt: new Date().toISOString(),
          };
          await store.put("users", user);
        }
        await issueSession(user, res);
      });
      res.clearCookie("google_state", cookie).redirect(`${origin()}/app`);
    } catch (error) {
      res
        .clearCookie("google_state", cookie)
        .redirect(
          `${origin()}/login?error=${error instanceof HttpError && error.status === 409 ? "existing-account" : "google-signin"}`,
        );
    }
  });
}
