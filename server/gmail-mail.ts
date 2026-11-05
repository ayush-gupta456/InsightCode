import nodemailer from "nodemailer";
import { HttpError } from "./security.js";

export function gmailReady(env = process.env) {
  return !!(
    env.GMAIL_CLIENT_ID &&
    env.GMAIL_CLIENT_SECRET &&
    env.GMAIL_REFRESH_TOKEN &&
    env.AUTH_EMAIL_FROM
  );
}

// Sending authorization belongs to the service mailbox, not to signing-in users.
export async function sendGmailReset(email: string, url: string) {
  const failure = () =>
    new HttpError(
      503,
      "Password reset email could not be sent. Please try again later",
    );
  if (!gmailReady()) throw failure();
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenResponse.ok) throw failure();
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw failure();
    const composer = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: "windows",
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const message = await composer.sendMail({
      from: process.env.AUTH_EMAIL_FROM,
      to: email,
      subject: "Reset your InsightCode password",
      text: `Use this link to reset your password within 30 minutes:\n\n${url}\n\nIf you did not request this, ignore this email.`,
    });
    if (!Buffer.isBuffer(message.message)) throw failure();
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: Buffer.from(message.message).toString("base64url"),
        }),
      },
    );
    if (!response.ok) throw failure();
  } catch {
    throw failure();
  }
}
