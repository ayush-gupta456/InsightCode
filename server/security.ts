import {
  createHmac,
  timingSafeEqual,
  createHash,
  randomBytes,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const fileSchema = z.object({
  path: z.string().min(1).max(240).refine(safePath, "Unsafe file path"),
  content: z.string().max(250_000),
});
export const filesSchema = z
  .array(fileSchema)
  .min(1)
  .max(200)
  .superRefine((files, ctx) => {
    if (
      files.reduce((sum, f) => sum + Buffer.byteLength(f.content), 0) >
      2_000_000
    )
      ctx.addIssue({ code: "custom", message: "Source exceeds 2 MB limit" });
    if (new Set(files.map((f) => f.path.toLowerCase())).size !== files.length)
      ctx.addIssue({ code: "custom", message: "Duplicate paths" });
  });
export function safePath(value: string) {
  return (
    !value.includes("\\") &&
    !value.includes("\0") &&
    !value.startsWith("/") &&
    !value.includes(":") &&
    !value.split("/").some((p) => p === ".." || p === "." || !p)
  );
}
export function verifyWebhook(body: Buffer, signature: string, secret: string) {
  if (!/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
  );
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("hex");
export function authTokens(secret: string) {
  if (secret.length < 32)
    throw new Error("JWT_SECRET must be at least 32 characters");
  const key = new TextEncoder().encode(secret);
  return {
    sign: (id: string, version = 0) =>
      new SignJWT({ version })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(id)
        .setIssuer("insightcode")
        .setAudience("insightcode-app")
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(key),
    claims: async (token: string) => (await jwtVerify(token,key,{issuer:'insightcode',audience:'insightcode-app',algorithms:['HS256']})).payload,
    verify: async (token: string) =>
      (
        await jwtVerify(token, key, {
          issuer: "insightcode",
          audience: "insightcode-app",
          algorithms: ["HS256"],
        })
      ).payload.sub!,
  };
}
