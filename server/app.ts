import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import multer from "multer";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { createPatch } from "diff";
import { Store } from "./store.js";
import {
  HttpError,
  authTokens,
  filesSchema,
  hashToken,
  randomToken,
  verifyWebhook,
} from "./security.js";
import {
  analyze,
  importZip,
  indexRepository,
  score,
  contextFor,
} from "./analysis.js";
import { githubGet, repositoryFiles } from "./github.js";
import { enrich, assistantReply, proposeFix } from "./ai.js";
import type { Review, User, Fix, EntityMap } from "../shared/types.js";
import { createLocks } from './locks.js';
import { githubToken, mountOAuthCallback, mountIntegrationRoutes, publishComment } from './integrations.js';
import { configuredAnalyzers, runAnalyzers, validateInContainer } from './runner.js';
import { mountTeams } from './teams.js';
import { AsyncLocalStorage } from 'node:async_hooks';

const now = () => new Date().toISOString();
export async function createApp(store: Store, secret: string) {
  const app = express();
  const tokens = authTokens(secret);
  const locked = createLocks();
  const context = new AsyncLocalStorage<{readOnly:boolean}>();
  const authLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173",
      credentials: true,
    }),
  );
  app.post(
    "/api/github/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      if (!process.env.GITHUB_WEBHOOK_SECRET)
        throw new HttpError(503, "Webhook not configured");
      if (
        !verifyWebhook(
          req.body,
          String(req.headers["x-hub-signature-256"] || ""),
          process.env.GITHUB_WEBHOOK_SECRET,
        )
      )
        throw new HttpError(401, "Invalid webhook signature");
      const delivery = z.string().uuid().parse(req.headers['x-github-delivery']);
      const event = z.object({action:z.string().optional(),number:z.number().int().positive().optional(),repository:z.object({name:z.string(),owner:z.object({login:z.string()})}).optional()}).parse(JSON.parse(req.body.toString('utf8')));
      await locked(`webhook:${delivery}`, async () => {
        if (await store.get('deliveries',delivery)) { res.status(202).json({received:true,duplicate:true}); return; }
        let count=0;
        if(req.headers['x-github-event']==='pull_request' && ['opened','reopened','synchronize'].includes(event.action || '') && event.repository && event.number) {
          for(const subscription of await store.list('subscriptions')) {
            if(subscription.owner!==event.repository.owner.login || subscription.repo!==event.repository.name || subscription.pull!==event.number) continue;
            const token=await githubToken(store,subscription.ownerId); if(!token)continue;
            const source=await repositoryFiles(subscription.owner,subscription.repo,'HEAD',token,subscription.pull);
            await submit(subscription.ownerId,{name:`${subscription.owner}/${subscription.repo} #${subscription.pull}`,files:source.files,ai:subscription.ai,projectId:subscription.projectId,source:'pull-request',github:{owner:subscription.owner,repo:subscription.repo,pull:subscription.pull,ref:source.commit}}); count++;
          }
        }
        await store.put('deliveries',{id:delivery,ownerId:'system',createdAt:now()});res.status(202).json({received:true,reviewsQueued:count});
      });
    },
  );
  app.use(express.json({ limit: "3mb" }));
  mountOAuthCallback(app,store);
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      persistence: process.env.MONGODB_URI ? "mongodb" : "local",
      aiConfigured: !!process.env.GEMINI_API_KEY,
    }),
  );
  const safeUser = (u: User) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/auth",
    maxAge: 7 * 86400_000,
  };
  async function issueSession(user: User, res: Response) {
    const refresh = randomToken();
    await store.put("sessions", {
      id: randomUUID(),
      ownerId: user.id,
      hash: hashToken(refresh),
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
    });
    res.cookie("refresh", refresh, cookieOptions);
    return { token: await tokens.sign(user.id), user: safeUser(user) };
  }
  const credentials = z.object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(12).max(72).refine(value => Buffer.byteLength(value) <= 72, 'Password must fit within 72 UTF-8 bytes'),
    name: z.string().trim().min(2).max(80).optional(),
  });
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const input = credentials.parse(req.body);
    await locked(`register:${input.email}`, async () => {
    if ((await store.list("users")).some((u) => u.email === input.email))
      throw new HttpError(409, "This email is already registered");
    const user: User = {
      id: randomUUID(),
      email: input.email,
      name: input.name || input.email.split("@")[0],
      passwordHash: await bcrypt.hash(input.password, 12),
      role: "member",
      createdAt: now(),
    };
    await store.put("users", user);
    res.status(201).json(await issueSession(user, res));
    });
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const input = credentials.parse(req.body);
    const user = (await store.list("users")).find(
      (u) => u.email === input.email,
    );
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
      throw new HttpError(401, "Invalid email or password");
    res.json(await issueSession(user, res));
  });
  const refreshCookie = (req: Request) =>
    req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("refresh="))
      ?.slice(8);
  app.post("/api/auth/refresh", authLimit, async (req, res) => {
    const raw = refreshCookie(req);
    if (!raw) throw new HttpError(401, "Sign in to continue");
    const session = (await store.list("sessions")).find(
      (s) => s.hash === hashToken(raw),
    );
    if (!session || Date.parse(session.expiresAt) < Date.now())
      throw new HttpError(401, "Session expired");
    if (!(await store.consume("sessions", session.id))) throw new HttpError(401, 'Session already used');
    const user = await store.get("users", session.ownerId);
    if (!user) throw new HttpError(401, "Account unavailable");
    res.json(await issueSession(user, res));
  });
  app.post("/api/auth/logout", async (req, res) => {
    const raw = refreshCookie(req);
    if (raw)
      for (const s of await store.list("sessions"))
        if (s.hash === hashToken(raw)) await store.remove("sessions", s.id);
    res.clearCookie("refresh", cookieOptions).json({ ok: true });
  });
  app.use("/api", async (req, res, next) => {
    try {
      res.locals.userId = await tokens.verify(
        req.headers.authorization?.replace(/^Bearer /, "") || "",
      );
      next();
    } catch {
      next(new HttpError(401, "Sign in to continue"));
    }
  });
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { next(); return; }
    void locked('api-mutations', () => new Promise<void>(resolve => {
      if (res.destroyed) { resolve(); return; }
      res.once('finish', resolve); res.once('close', resolve); next();
    })).catch(next);
  });
  app.use('/api',(req,_res,next)=>context.run({readOnly:['GET','HEAD'].includes(req.method)},next));
  mountIntegrationRoutes(app,store);
  mountTeams(app,store);
  async function visibleProjects(userId:string) {
    const teamIds = new Set((await store.list('teams')).filter(t=>t.members.some(m=>m.userId===userId)).map(t=>t.id));
    return (await store.list('projects')).filter(p=>p.teamId?teamIds.has(p.teamId):p.ownerId===userId);
  }
  async function visibleReviews(userId:string) {
    const projectIds=new Set((await visibleProjects(userId)).map(p=>p.id));
    const sharedIds=new Set((await store.list('projects')).filter(p=>p.teamId).map(p=>p.id));
    return (await store.list('reviews')).filter(r=>r.projectId && sharedIds.has(r.projectId)?projectIds.has(r.projectId):r.ownerId===userId);
  }
  async function owned<K extends keyof EntityMap>(
    collection: K,
    id: string,
    userId: string,
  ): Promise<EntityMap[K]> {
    const entity = await store.get(collection, id);
    if (!entity || !("ownerId" in entity)) throw new HttpError(404,'Not found');
    let project:EntityMap['projects'] | undefined;
    if(collection==='projects')project=entity as EntityMap['projects'];
    if(collection==='reviews'){const r=entity as Review;if(r.projectId)project=await store.get('projects',r.projectId);}
    if(collection==='fixes'){const fix=entity as Fix;const r=await store.get('reviews',fix.reviewId);if(r?.projectId)project=await store.get('projects',r.projectId);}
    if(!project?.teamId){if(entity.ownerId===userId)return entity;throw new HttpError(404,'Not found');}
    const team=project?.teamId?await store.get('teams',project.teamId):undefined;
    const member=team?.members.find(m=>m.userId===userId);
    if(!member)throw new HttpError(404,'Not found');
    if(!context.getStore()?.readOnly && member.role==='viewer')throw new HttpError(403,'Viewer access is read-only');
    return entity;
  }
  async function audit(ownerId: string, action: string, resourceId: string) {
    await store.put("audit", {
      id: randomUUID(),
      ownerId,
      action,
      resourceId,
      createdAt: now(),
    });
  }
  app.get("/api/me", async (_req, res) =>
    res.json(safeUser((await store.get("users", res.locals.userId))!)),
  );
  app.patch("/api/me", async (req, res) => {
    const { name } = z
      .object({ name: z.string().trim().min(2).max(80) })
      .parse(req.body);
    const user = (await store.get("users", res.locals.userId))!;
    user.name = name;
    await store.put("users", user);
    res.json(safeUser(user));
  });
  app.get("/api/capabilities", (_req, res) =>
    res.json({
      gemini: !!process.env.GEMINI_API_KEY && !!process.env.GEMINI_MODEL,
      github: process.env.GITHUB_CLIENT_ID ? 'oauth' : 'public-read',
      persistence: process.env.MONGODB_URI
        ? "MongoDB"
        : "Local development store",
      queue: process.env.REDIS_URL ? "BullMQ" : "Local background jobs",
      analyzers: ["InsightCode rules", "TypeScript AST", ...configuredAnalyzers()],
      externalAnalyzers: process.env.ANALYZER_IMAGE ? 'Docker worker configured' : 'Not configured',
      isolatedTests: !!process.env.ANALYZER_IMAGE,
      billing: false,
      team: true,
    }),
  );
  app.get("/api/projects", async (_req, res) =>
    res.json(await visibleProjects(res.locals.userId)),
  );
  app.post("/api/projects", async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(2).max(80),
        description: z.string().max(500).default(""),
        teamId:z.string().optional().transform(s=>s || undefined),
      })
      .parse(req.body);
    if(input.teamId){const team=await store.get('teams',input.teamId);const role=team?.members.find(m=>m.userId===res.locals.userId)?.role;if(!role || role==='viewer')throw new HttpError(403,'Team editor access is required');}
    const project = {
      ...input,
      id: randomUUID(),
      ownerId: res.locals.userId,
      createdAt: now(),
    };
    await store.put("projects", project);
    await audit(project.ownerId, "project.created", project.id);
    res.status(201).json(project);
  });
  app.delete("/api/projects/:id", async (req, res) => {
    await owned("projects", String(req.params.id), res.locals.userId);
    await store.remove("projects", String(req.params.id));
    res.status(204).end();
  });

  const processing = new Set<string>();
  const listeners = new Set<(review: Review) => void>();
  async function saveReview(review: Review) {
    await store.put("reviews", review);
    for (const listener of listeners) listener(review);
  }
  async function processReview(id: string) {
    if (processing.has(id)) return;
    processing.add(id);
    const review = await store.get("reviews", id);
    if (!review) {
      processing.delete(id);
      return;
    }
    try {
      review.status = "running";
      review.logs.push("Source accepted. Starting deterministic analysis.");
      await saveReview(review);
      review.findings = analyze(review.files);
      const external = await runAnalyzers(review.files,async message=>{review.logs.push(message);await saveReview(review);});
      for(const finding of external)if(!review.findings.some(f=>f.file===finding.file && f.startLine===finding.startLine && f.title===finding.title))review.findings.push(finding);
      review.logs.push(
        `Analyzed ${review.files.length} files. ${review.findings.length} rule matches.`,
      );
      await saveReview(review);
      if (review.ai) {
        review.logs.push("Retrieving bounded context for Gemini.");
        await saveReview(review);
        try {
          review.findings = await enrich(review.files, review.findings);
          review.logs.push("Validated AI findings against source evidence.");
        } catch (e) {
          review.logs.push(
            `AI enrichment unavailable: ${e instanceof HttpError ? e.message : "provider response could not be validated"}. Deterministic results retained.`,
          );
        }
      }
      review.score = score(review.findings);
      review.status = "completed";
      review.logs.push(
        "Review complete. Security hotspots require human confirmation.",
      );
      await saveReview(review);
      await store.put("notifications", {
        id: randomUUID(),
        ownerId: review.ownerId,
        title: `${review.name} is ready`,
        reviewId: id,
        read: false,
        createdAt: now(),
      });
    } catch {
      review.status = "failed";
      review.error = "Analysis failed. Please retry with a smaller source set.";
      await saveReview(review);
    } finally {
      processing.delete(id);
    }
  }
  let enqueue = async (id: string) => {
    setImmediate(() => {
      void processReview(id);
    });
  };
  let closeQueue = async () => {};
  if (process.env.REDIS_URL) {
    const { Queue, Worker } = await import("bullmq");
    const { default: Redis } = await import("ioredis");
    const connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    const queue = new Queue("insightcode-reviews", { connection });
    const worker = new Worker(
      "insightcode-reviews",
      async (job) => processReview(job.data.id),
      { connection, concurrency: 2 },
    );
    enqueue = async (id) => {
      await queue.add(
        "review",
        { id },
        { jobId: id, removeOnComplete: 100, removeOnFail: 100 },
      );
    };
    closeQueue = async () => {
      await worker.close();
      await queue.close();
      await connection.quit();
    };
  }
  async function submit(
    ownerId: string,
    input: {
      name: string;
      files: Review["files"];
      projectId?: string;
      ai: boolean;
      source?: string;
      github?: Review['github'];
    },
  ) {
    if (input.projectId) await owned("projects", input.projectId, ownerId);
    const existing = await store.list("reviews", ownerId);
    if (
      existing.filter((r) => r.createdAt.slice(0, 10) === now().slice(0, 10))
        .length >= 50
    )
      throw new HttpError(429, "Daily review limit reached (50)");
    if (
      existing.filter((r) => ["queued", "running"].includes(r.status)).length >=
      3
    )
      throw new HttpError(429, "Three reviews are already queued or running");
    const review: Review = {
      id: randomUUID(),
      ownerId,
      name: input.name,
      files: filesSchema.parse(input.files),
      projectId: input.projectId,
      ai: input.ai,
      source: input.source || "upload",
      findings: [],
      status: "queued",
      logs: ["Review queued"],
      createdAt: now(),
      revision: 0,
      github: input.github,
    };
    await saveReview(review);
    await audit(ownerId, "review.created", review.id);
    await enqueue(review.id);
    return review;
  }
  const submission = z.object({
    name: z.string().trim().min(1).max(100),
    files: filesSchema,
    projectId: z.string().optional(),
    ai: z.boolean().default(false),
  });
  app.post("/api/reviews", async (req, res) =>
    res
      .status(202)
      .json(await submit(res.locals.userId, submission.parse(req.body))),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5_000_000, files: 1, fields: 5 },
  });
  app.post("/api/reviews/zip", upload.single("file"), async (req, res) => {
    if (!req.file) throw new HttpError(400, "ZIP file required");
    const input = submission
      .omit({ files: true, ai: true })
      .extend({ ai: z.enum(["true", "false"]).default("false") })
      .parse(req.body);
    res
      .status(202)
      .json(
        await submit(res.locals.userId, {
          ...input,
          ai: input.ai === "true",
          files: importZip(req.file.buffer),
          source: "zip",
        }),
      );
  });
  app.get("/api/reviews", async (_req, res) =>
    res.json(
      (await visibleReviews(res.locals.userId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ files, ...r }) => ({ ...r, fileCount: files.length })),
    ),
  );
  app.get("/api/reviews/:id", async (req, res) =>
    res.json(await owned("reviews", String(req.params.id), res.locals.userId)),
  );
  app.get("/api/reviews/:id/index", async (req, res) =>
    res.json(
      indexRepository(
        (await owned("reviews", String(req.params.id), res.locals.userId))
          .files,
      ),
    ),
  );
  app.patch("/api/reviews/:id/findings/:findingId", async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["open", "dismissed", "resolved"]) })
      .parse(req.body);
    const review = await owned(
      "reviews",
      String(req.params.id),
      res.locals.userId,
    );
    const finding = review.findings.find((f) => f.id === req.params.findingId);
    if (review.status !== 'completed') throw new HttpError(409,'Wait for review completion');
    if (!finding) throw new HttpError(404, "Finding not found");
    finding.status = status;
    review.score = score(review.findings);
    await saveReview(review);
    await audit(res.locals.userId, `finding.${status}`, finding.id);
    res.json(review);
  });
  app.get("/api/analytics", async (_req, res) => {
    const reviews = await visibleReviews(res.locals.userId);
    const completed = reviews.filter((r) => r.status === "completed");
    const findings = completed
      .flatMap((r) => r.findings)
      .filter((f) => f.status === "open");
    const languages: Record<string, number> = {};
    for (const r of completed)
      for (const f of indexRepository(r.files))
        languages[f.language] = (languages[f.language] || 0) + f.lines;
    res.json({
      reviews: reviews.length,
      projects: (await visibleProjects(res.locals.userId)).length,
      findings: findings.length,
      security: findings.filter((f) => f.category === "security").length,
      critical: findings.filter((f) =>
        ["critical", "high"].includes(f.severity),
      ).length,
      score: completed.length
        ? Math.round(
            completed.reduce((n, r) => n + (r.score || 0), 0) /
              completed.length,
          )
        : null,
      languages,
      trends: completed
        .slice(-20)
        .map((r) => ({
          name: new Date(r.createdAt).toLocaleDateString("en-GB", {
            month: "short",
            day: "numeric",
          }),
          score: r.score,
          findings: r.findings.length,
        })),
      methodology:
        "Per review: max(0, 100 − 20×critical − 10×high − 4×medium − low), using open findings. Overall is the mean of completed reviews. This is a rule-based indicator, not a security certification. Language counts include each review snapshot.",
    });
  });
  app.get("/api/notifications", async (_req, res) =>
    res.json(await store.list("notifications", res.locals.userId)),
  );
  app.post("/api/notifications/read", async (_req, res) => {
    for (const n of await store.list("notifications", res.locals.userId))
      await store.put("notifications", { ...n, read: true });
    res.json({ ok: true });
  });
  app.get("/api/audit", async (_req, res) =>
    res.json(await store.list("audit", res.locals.userId)),
  );
  app.get("/api/usage", async (_req, res) => {
    const reviews = await store.list("reviews", res.locals.userId);
    res.json({
      today: reviews.filter(
        (r) => r.createdAt.slice(0, 10) === now().slice(0, 10),
      ).length,
      dailyLimit: 50,
      total: reviews.length,
      plan: "Self-hosted",
      billingEnabled: false,
    });
  });
  app.get("/api/reviews/:id/messages", async (req, res) => {
    await owned("reviews", String(req.params.id), res.locals.userId);
    res.json(
      (await store.list("messages", res.locals.userId)).filter(
        (m) => m.reviewId === req.params.id,
      ),
    );
  });
  app.post("/api/reviews/:id/messages", async (req, res) => {
    const { content } = z
      .object({ content: z.string().trim().min(1).max(4000) })
      .parse(req.body);
    const review = await owned(
      "reviews",
      String(req.params.id),
      res.locals.userId,
    );
    const history = (await store.list("messages", res.locals.userId))
      .filter((m) => m.reviewId === review.id)
      .slice(-10);
    const reply = await assistantReply(
      content,
      contextFor(review.files, content),
      history,
    );
    const base = {
      ownerId: res.locals.userId,
      reviewId: review.id,
      createdAt: now(),
    };
    await store.put("messages", {
      ...base,
      id: randomUUID(),
      role: "user",
      content,
    });
    const message = {
      ...base,
      id: randomUUID(),
      role: "assistant" as const,
      content: reply,
    };
    await store.put("messages", message);
    res.json(message);
  });
  app.post("/api/reviews/:id/fixes", async (req, res) => {
    const { file, replacement, findingId } = z
      .object({
        file: z.string(),
        replacement: z.string().max(250_000).optional(),
        findingId: z.string().optional(),
      })
      .parse(req.body);
    const review = await owned(
      "reviews",
      String(req.params.id),
      res.locals.userId,
    );
    if (review.status !== "completed")
      throw new HttpError(409, "Wait for review completion");
    const source = review.files.find((f) => f.path === file);
    if (!source) throw new HttpError(404, "File not found");
    const finding = review.findings.find((f) => f.id === findingId);
    if (replacement === undefined && !finding)
      throw new HttpError(400, "A finding or replacement is required");
    const next = replacement ?? (await proposeFix(source, finding!));
    if (next === source.content)
      throw new HttpError(400, "No changes to preview");
    const fix: Fix = {
      id: randomUUID(),
      ownerId: res.locals.userId,
      reviewId: review.id,
      file,
      original: source.content,
      replacement: next,
      diff: createPatch(file, source.content, next),
      status: "proposed",
      createdAt: now(),
      baseRevision: review.revision,
    };
    await store.put("fixes", fix);
    res.status(201).json(fix);
  });
  app.get("/api/reviews/:id/fixes", async (req, res) => {
    await owned("reviews", String(req.params.id), res.locals.userId);
    res.json(
      (await store.list("fixes", res.locals.userId)).filter(
        (f) => f.reviewId === req.params.id,
      ),
    );
  });
  app.post('/api/fixes/:id/validate',async(req,res)=>{
    z.object({approved:z.literal(true)}).parse(req.body);
    const fix=await owned('fixes',String(req.params.id),res.locals.userId);const review=await owned('reviews',fix.reviewId,res.locals.userId);
    const before=review.files.map(f=>f.path===fix.file?{...f,content:fix.original}:f);const after=review.files.map(f=>f.path===fix.file?{...f,content:fix.replacement}:f);
    const baseline=await validateInContainer(before);const patched=await validateInContainer(after);
    fix.validationDetails={baseline,patched,beforeFindings:analyze(before).length,afterFindings:analyze(after).length};fix.validation=`Isolated Node tests: baseline ${baseline.status}, patch ${patched.status}. Deterministic findings: ${fix.validationDetails.beforeFindings} → ${fix.validationDetails.afterFindings}.`;
    await store.put('fixes',fix);await audit(res.locals.userId,'fix.validated',fix.id);res.json(fix);
  });
  app.post("/api/fixes/:id/:action", async (req, res) => {
    const action = z.enum(["apply", "revert"]).parse(req.params.action);
    z.object({ approved: z.literal(true) }).parse(req.body);
    const fix = await owned("fixes", String(req.params.id), res.locals.userId);
    const review = await owned("reviews", fix.reviewId, res.locals.userId);
    const file = review.files.find((f) => f.path === fix.file)!;
    if (
      action === "apply" &&
      (fix.status !== "proposed" ||
        file.content !== fix.original ||
        review.revision !== fix.baseRevision)
    )
      throw new HttpError(409, "Source changed. Generate a new preview.");
    if (
      action === "revert" &&
      (fix.status !== "applied" || file.content !== fix.replacement)
    )
      throw new HttpError(409, "This patch can no longer be safely reverted.");
    file.content = action === "apply" ? fix.replacement : fix.original;
    review.revision++;
    review.findings = analyze(review.files);
    review.score = score(review.findings);
    fix.status = action === "apply" ? "applied" : "reverted";
    fix.validation =
      "Deterministic analysis rerun. Source was not executed; tests and external analyzers have not run.";
    review.logs.push(
      `Patch ${fix.status} to isolated review snapshot. ${fix.validation}`,
    );
    await store.put("fixes", fix);
    await saveReview(review);
    await audit(res.locals.userId, `fix.${fix.status}`, fix.id);
    res.json({ fix, review });
  });
  const repoInput = z.object({
    owner: z
      .string()
      .regex(/^[\w.-]+$/)
      .max(100),
    repo: z
      .string()
      .regex(/^[\w.-]+$/)
      .max(100),
    ref: z.string().min(1).max(200).default("HEAD"),
    pull: z.number().int().positive().optional(),
    ai: z.boolean().default(false),
    projectId: z.string().optional(),
  });
  app.post("/api/github/review", async (req, res) => {
    const input = repoInput.parse(req.body);
    const source = await repositoryFiles(
      input.owner,
      input.repo,
      input.ref,
      await githubToken(store,res.locals.userId),
      input.pull,
    );
    res
      .status(202)
      .json(
        await submit(res.locals.userId, {
          ...input,
          name: `${input.owner}/${input.repo}${input.pull ? ` #${input.pull}` : ""}`,
          files:source.files,
          source: input.pull ? "pull-request" : "github",
          github: {owner:input.owner,repo:input.repo,pull:input.pull,ref:source.commit},
        }),
      );
  });
  app.get("/api/github/:owner/:repo/branches", async (req, res) => {
    const input = repoInput.parse(req.params);
    res.json(
      await githubGet(
        `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/branches?per_page=100`, await githubToken(store,res.locals.userId),
      ),
    );
  });
  app.get("/api/github/:owner/:repo/pulls", async (req, res) => {
    const input = repoInput.parse(req.params);
    res.json(
      await githubGet(
        `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls?state=open&per_page=100`, await githubToken(store,res.locals.userId),
      ),
    );
  });
  app.post('/api/reviews/:id/github/publish', async(req,res)=>{
    const {approved,body,findingId}=z.object({approved:z.literal(true),body:z.string().trim().min(1).max(20_000),findingId:z.string().optional()}).parse(req.body);
    const review=await owned('reviews',String(req.params.id),res.locals.userId);
    if(!review.github?.pull)throw new HttpError(400,'This review is not associated with a pull request');
    const token=await githubToken(store,res.locals.userId);if(!token)throw new HttpError(409,'Connect GitHub to publish');
    const {owner,repo,pull}=review.github;const base=`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    let result;
    const pr=await githubGet(`${base}/pulls/${pull}`,token);
    if(pr.head.sha!==review.github.ref || review.revision!==0)throw new HttpError(409,'The pull request or local snapshot changed. Run a fresh review before publishing.');
    if(findingId){const finding=review.findings.find(f=>f.id===findingId);if(!finding)throw new HttpError(404,'Finding not found');result=await publishComment(`${base}/pulls/${pull}/reviews`,{event:'COMMENT',body:'InsightCode review (user approved)',commit_id:pr.head.sha,comments:[{path:finding.file,line:finding.startLine,side:'RIGHT',body}]},token);}
    else result=await publishComment(`${base}/issues/${pull}/comments`,{body},token);
    await audit(res.locals.userId,'github.review-published',review.id);res.json(result);
  });
  app.post('/api/reviews/:id/github/subscribe',async(req,res)=>{
    z.object({approved:z.literal(true)}).parse(req.body);const review=await owned('reviews',String(req.params.id),res.locals.userId);
    if(!review.github?.pull)throw new HttpError(400,'Select a pull request review');if(!process.env.GITHUB_WEBHOOK_SECRET)throw new HttpError(503,'Configure the GitHub webhook first');
    if(!await githubToken(store,res.locals.userId))throw new HttpError(409,'Connect GitHub first');
    const id=hashToken(`${review.ownerId}:${review.github.owner}/${review.github.repo}#${review.github.pull}`);
    await store.put('subscriptions',{id,ownerId:review.ownerId,...review.github,pull:review.github.pull,ai:review.ai,projectId:review.projectId,createdAt:now()});res.json({enabled:true});
  });
  app.get("/api/admin", async (_req, res) => {
    const user = await store.get("users", res.locals.userId);
    if (user?.role !== "admin")
      throw new HttpError(403, "Administrator access required");
    res.json({
      users: (await store.list("users")).map(safeUser),
      reviews: (await store.list("reviews")).length,
    });
  });
  app.use("/api", (_req, _res, next) =>
    next(new HttpError(404, "Endpoint not found")),
  );
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof ZodError
          ? 400
          : error instanceof multer.MulterError
            ? 413
            : error.type === "entity.parse.failed" ? 400 : error.code === 11000 ? 409 : error.type === "entity.too.large"
              ? 413
              : 500;
    res
      .status(status)
      .json({
        error:
          status === 500
            ? "The request could not be completed"
            : error instanceof ZodError
              ? error.issues.map((i) => i.message).join("; ")
              : error.message,
      });
  });
  for (const r of await store.list("reviews"))
    if (["running", "queued"].includes(r.status)) await enqueue(r.id);
  return { app, tokens, listeners, closeQueue };
}
