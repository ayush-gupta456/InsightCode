import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";

test("account → project → review → finding → patch → revert with access isolation", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "insightcode-test-"));
  const store = new Store(directory, "");
  await store.init();
  const { app, closeQueue } = await createApp(store, "test-secret-".repeat(4));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api`;
  const request = async (
    url: string,
    method = "GET",
    body?: unknown,
    token?: string,
    cookie?: string,
  ) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: res.status,
      body: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  };
  try {
    assert.equal((await request("/reviews")).status, 401);
    const account = await request("/auth/register", "POST", {
      email: "alex@example.test",
      name: "Alex",
      password: "test-password-123",
    });
    assert.equal(account.status, 201);
    assert.ok(account.cookie?.startsWith("refresh="));
    assert.equal(account.body.user.passwordHash, undefined);
    const token = account.body.token;
    assert.equal(
      (
        await request("/auth/register", "POST", {
          email: "ALEX@example.test",
          password: "test-password-123",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("/auth/login", "POST", {
          email: "alex@example.test",
          password: "wrong-password-123",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request("/auth/login", "POST", {
          email: "alex@example.test",
          password: "test-password-123",
        })
      ).status,
      200,
    );
    const stranger = await request("/auth/register", "POST", {
      email: "other@example.test",
      password: "test-password-123",
    });
    const project = await request(
      "/projects",
      "POST",
      { name: "Application", description: "API test" },
      token,
    );
    assert.equal(project.status, 201);
    const file = {
      path: "main.ts",
      content: "export function run(input: string) {\n return eval(input);\n}",
    };
    assert.equal(
      (
        await request(
          "/reviews",
          "POST",
          {
            name: "Illegal project",
            projectId: project.body.id,
            files: [file],
          },
          stranger.body.token,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          "/reviews",
          "POST",
          { name: "Traversal", files: [{ path: "../secret", content: "x" }] },
          token,
        )
      ).status,
      400,
    );
    const submission = await request(
      "/reviews",
      "POST",
      {
        name: "API security review",
        projectId: project.body.id,
        files: [file],
      },
      token,
    );
    assert.equal(submission.status, 202);
    const reviewId = submission.body.id;
    let review;
    for (let i = 0; i < 50; i++) {
      review = await request(`/reviews/${reviewId}`, "GET", undefined, token);
      if (review.body.status === "completed") break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(review!.body.status, "completed");
    assert.equal(review!.body.findings.length, 1);
    assert.equal(review!.body.score, 90);
    assert.equal(
      (
        await request(
          `/reviews/${reviewId}`,
          "GET",
          undefined,
          stranger.body.token,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          `/reviews/${reviewId}/messages`,
          "POST",
          { content: "Explain this" },
          stranger.body.token,
        )
      ).status,
      404,
    );
    const finding = review!.body.findings[0];
    const patch = await request(
      `/reviews/${reviewId}/fixes`,
      "POST",
      {
        file: "main.ts",
        replacement:
          "export function run(input: string) {\n return JSON.parse(input);\n}",
      },
      token,
    );
    assert.equal(patch.status, 201);
    assert.match(patch.body.diff, /- return eval/);
    assert.equal(
      (
        await request(
          `/fixes/${patch.body.id}/apply`,
          "POST",
          { approved: false },
          token,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          `/fixes/${patch.body.id}/apply`,
          "POST",
          { approved: true },
          stranger.body.token,
        )
      ).status,
      404,
    );
    const applied = await request(
      `/fixes/${patch.body.id}/apply`,
      "POST",
      { approved: true },
      token,
    );
    assert.equal(applied.status, 200);
    assert.equal(applied.body.review.findings.length, 0);
    assert.match(applied.body.fix.validation, /tests.*have not run/);
    assert.equal(
      (
        await request(
          `/fixes/${patch.body.id}/apply`,
          "POST",
          { approved: true },
          token,
        )
      ).status,
      409,
    );
    const reverted = await request(
      `/fixes/${patch.body.id}/revert`,
      "POST",
      { approved: true },
      token,
    );
    assert.equal(reverted.status, 200);
    assert.equal(reverted.body.review.files[0].content, file.content);
    const active = reverted.body.review.findings[0];
    const dismissed = await request(
      `/reviews/${reviewId}/findings/${active.id}`,
      "PATCH",
      { status: "dismissed" },
      token,
    );
    assert.equal(dismissed.status, 200);
    assert.equal(dismissed.body.score, 100);
    const analytics = await request("/analytics", "GET", undefined, token);
    assert.equal(analytics.body.reviews, 1);
    assert.equal(analytics.body.findings, 0);
    assert.equal(analytics.body.projects, 1);
    assert.equal(
      (await request("/analytics", "GET", undefined, stranger.body.token)).body
        .reviews,
      0,
    );
    assert.equal(
      (await request("/admin", "GET", undefined, token)).status,
      403,
    );
    const team = await request('/teams','POST',{name:'Shared team'},token);
    const invitation = await request(`/teams/${team.body.id}/invitations`,'POST',{email:'other@example.test',role:'editor'},token);
    const inviteToken = new URL(invitation.body.url).searchParams.get('invite');
    assert.equal((await request('/teams/accept','POST',{token:inviteToken},stranger.body.token)).status,200);
    const sharedProject = await request('/projects','POST',{name:'Shared project',teamId:team.body.id},stranger.body.token);
    assert.equal(sharedProject.status,201);
    const sharedReview = await request('/reviews','POST',{name:'Shared source',projectId:sharedProject.body.id,files:[file]},stranger.body.token);
    assert.equal(sharedReview.status,202);
    await request(`/teams/${team.body.id}/members/${stranger.body.user.id}`,'PATCH',{role:'viewer'},token);
    assert.equal((await request(`/reviews/${sharedReview.body.id}/fixes`,'POST',{file:'main.ts',replacement:'safe'},stranger.body.token)).status,403);
    const removed = await fetch(`${base}/teams/${team.body.id}/members/${stranger.body.user.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
    assert.equal(removed.status,204);
    assert.equal((await request(`/reviews/${sharedReview.body.id}`,'GET',undefined,stranger.body.token)).status,404);
    assert.equal((await request('/reviews','GET',undefined,stranger.body.token)).body.length,0);
    assert.equal((await request('/projects','GET',undefined,stranger.body.token)).body.length,0);
    const rotated = await request(
      "/auth/refresh",
      "POST",
      {},
      undefined,
      account.cookie,
    );
    assert.equal(rotated.status, 200);
    assert.notEqual(rotated.cookie, account.cookie);
    assert.equal(
      (await request("/auth/refresh", "POST", {}, undefined, account.cookie))
        .status,
      401,
    );
    await request("/auth/logout", "POST", {}, undefined, rotated.cookie);
    assert.equal(
      (await request("/auth/refresh", "POST", {}, undefined, rotated.cookie))
        .status,
      401,
    );
    const reloaded = new Store(directory, "");
    await reloaded.init();
    assert.equal(
      (await reloaded.get("reviews", reviewId))?.name,
      "API security review",
    );
  } finally {
    await closeQueue();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
