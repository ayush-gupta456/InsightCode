import test from "node:test";
import assert from "node:assert/strict";
import { deliverReset } from "../server/account-recovery.js";
import { gmailReady } from "../server/gmail-mail.js";
test("Gmail sends MIME over HTTPS and rejects failures without SMTP fallback or secret leakage", async () => {
  const keys = [
    "AUTH_EMAIL_PROVIDER",
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "AUTH_EMAIL_FROM",
  ];
  const previous = { ...process.env };
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  let reject = false;
  Object.assign(process.env, {
    AUTH_EMAIL_PROVIDER: "gmail",
    GMAIL_CLIENT_ID: "client",
    GMAIL_CLIENT_SECRET: "private-client-secret",
    GMAIL_REFRESH_TOKEN: "private-refresh",
    AUTH_EMAIL_FROM: "InsightCode <sender@gmail.com>",
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    return new Response(
      JSON.stringify(
        reject
          ? { error: "private-provider-detail" }
          : url.includes("/token")
            ? { access_token: "access-secret" }
            : { id: "sent" },
      ),
      { status: reject ? 400 : 200 },
    );
  };
  try {
    assert.equal(gmailReady(), true);
    await deliverReset(
      "recipient@example.test",
      "https://example.test/reset-password#token=abc",
    );
    assert.deepEqual(
      calls.map((c) => c.url),
      [
        "https://oauth2.googleapis.com/token",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      ],
    );
    const form = new URLSearchParams(String(calls[0].init?.body));
    assert.equal(form.get("grant_type"), "refresh_token");
    assert.equal(form.get("refresh_token"), "private-refresh");
    const raw = JSON.parse(String(calls[1].init?.body)).raw;
    assert.match(raw, /^[A-Za-z0-9_-]+$/);
    const mime = Buffer.from(raw, "base64url").toString();
    assert.match(mime, /To: recipient@example.test/);
    assert.match(mime, /Reset your InsightCode password/);
    assert.match(mime, /#token=3Dabc|#token=abc/);
    reject = true;
    await assert.rejects(
      deliverReset("recipient@example.test", "https://example.test"),
      (e) =>
        e instanceof Error &&
        !e.message.includes("private") &&
        e.message.includes("could not be sent"),
    );
    delete process.env.GMAIL_REFRESH_TOKEN;
    assert.equal(gmailReady(), false);
    const count = calls.length;
    await assert.rejects(
      deliverReset("recipient@example.test", "https://example.test"),
    );
    assert.equal(calls.length, count);
  } finally {
    globalThis.fetch = original;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
