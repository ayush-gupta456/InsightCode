import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";
import { hashToken } from "../server/security.js";

test("password recovery uses expiring single-use tokens and revokes existing sessions", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "insight-auth-"));
  const store = new Store(dir, "");
  await store.init();
  const originalFetch = globalThis.fetch;
  let mail = "";
  process.env.RESEND_API_KEY = "test";
  process.env.AUTH_EMAIL_FROM = "test@example.test";
  globalThis.fetch = async (input, init) =>
    String(input) === "https://api.resend.com/emails"
      ? ((mail = JSON.parse(String(init?.body)).text),
        new Response("{}", { status: 200 }))
      : originalFetch(input, init);
  const { app, closeQueue } = await createApp(
    store,
    "test-auth-secret-".repeat(4),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  async function req(
    url: string,
    body?: unknown,
    token?: string,
    cookie?: string,
  ) {
    const r = await originalFetch(base + url, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  try {
    const account = await req("/auth/register", {
      email: "reset@example.test",
      password: "original-password-123",
    });
    assert.equal(account.status, 201);
    const missing = await req("/auth/forgot-password", {
      email: "missing@example.test",
    });
    const known = await req("/auth/forgot-password", {
      email: "reset@example.test",
    });
    assert.deepEqual(known.body, missing.body);
    const token = mail.match(/#token=([a-f0-9]{64})/)![1];
    assert.ok(await store.get("passwordResets", hashToken(token)));
    assert.equal(await store.get("passwordResets", token), undefined);
    assert.equal(
      (
        await req("/auth/reset-password", {
          token: "0".repeat(64),
          password: "updated-password-123",
        })
      ).status,
      400,
    );
    assert.equal(
      (await req("/auth/reset-password", { token, password: "short" })).status,
      400,
    );
    assert.equal(
      (
        await req("/auth/reset-password", {
          token,
          password: "updated-password-123",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await req("/auth/reset-password", {
          token,
          password: "another-password-123",
        })
      ).status,
      400,
    );
    assert.equal(
      (await req("/reviews", undefined, account.body.token)).status,
      401,
    );
    assert.equal(
      (await req("/auth/refresh", {}, undefined, account.cookie)).status,
      401,
    );
    assert.equal(
      (
        await req("/auth/login", {
          email: "reset@example.test",
          password: "original-password-123",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await req("/auth/login", {
          email: "reset@example.test",
          password: "updated-password-123",
        })
      ).status,
      200,
    );
    await store.put("passwordResets", {
      id: hashToken("a".repeat(64)),
      ownerId: account.body.user.id,
      version: 1,
      expiresAt: new Date(0).toISOString(),
    });
    assert.equal(
      (
        await req("/auth/reset-password", {
          token: "a".repeat(64),
          password: "expired-password-123",
        })
      ).status,
      400,
    );
    const response = await originalFetch(
      base + "/auth/google/callback?state=bad&code=bad",
      { redirect: "manual" },
    );
    assert.equal(response.status, 302);
    assert.match(response.headers.get("location")!, /error=google-signin/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    await closeQueue();
    await new Promise<void>((r) => server.close(() => r()));
    await fs.rm(dir, { recursive: true, force: true });
  }
});

import { smtpOptions, deliverReset } from "../server/account-recovery.js";
import nodemailer from "nodemailer";
test("SMTP requires TLS, rejects placeholders, and sends reset links without Resend", async () => {
  const env = {
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "587",
    SMTP_USER: "sender@gmail.com",
    SMTP_PASS: "test-app-password",
  };
  assert.equal(
    smtpOptions({ ...env, SMTP_PASS: "YOUR_16_CHARACTER_APP_PASSWORD" }),
    undefined,
  );
  assert.equal(smtpOptions({ ...env, SMTP_PORT: "25" }), undefined);
  assert.equal(smtpOptions(env)?.requireTLS, true);
  assert.equal(smtpOptions(env)?.secure, false);
  assert.equal(smtpOptions({ ...env, SMTP_PORT: "465" })?.secure, true);
  const previous = { ...process.env };
  const original = nodemailer.createTransport;
  let sent: any;
  let closed = false;
  Object.assign(process.env, env, {
    AUTH_EMAIL_FROM: "InsightCode <sender@gmail.com>",
  });
  nodemailer.createTransport = (() => ({
    sendMail: async (message: any) => {
      sent = message;
    },
    close: () => {
      closed = true;
    },
  })) as any;
  try {
    await deliverReset(
      "recipient@example.test",
      "https://example.test/reset-password#token=test",
    );
    assert.equal(sent.to, "recipient@example.test");
    assert.match(sent.text, /#token=test/);
    assert.equal(closed, true);
  } finally {
    nodemailer.createTransport = original;
    for (const key of [...Object.keys(env), "AUTH_EMAIL_FROM"]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
