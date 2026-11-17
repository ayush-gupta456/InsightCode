import { HttpError } from "./security.js";

// Never expose provider response bodies, request headers, or credentials.
export function aiFailureMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  type ProviderError = { statusCode?: number; name?: string; finishReason?: string; cause?: unknown; lastError?: unknown; errors?: unknown[] };
  const e = error as ProviderError | null;
  const queue: unknown[] = [error], seen = new Set<unknown>();
  let status: number | undefined, timedOut = false, truncated = false;
  // SDK retry wrappers may keep the actionable status in lastError or errors, not cause.
  while (queue.length && seen.size < 12) {
    const item = queue.shift();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item);
    const nested = item as ProviderError;
    if (typeof nested.statusCode === "number") { status = nested.statusCode; break; }
    timedOut ||= nested.name === "TimeoutError" || nested.name === "AbortError";
    truncated ||= nested.finishReason === "length";
    queue.push(nested.cause, nested.lastError, ...(nested.errors || []).slice(0, 3));
  }
  if (status === 429) return "AI quota or rate limit reached. Check the provider quota and retry later";
  if (status === 401 || status === 403) return "AI credentials or model access were rejected. Check the server's Gemini configuration";
  if (status === 404) return "The configured AI model is unavailable. Check GEMINI_MODEL on the server";
  if (status && status >= 500) return `The AI provider is temporarily unavailable (HTTP ${status}). Retry later`;
  if (timedOut || e?.name === "TimeoutError" || e?.name === "AbortError") return "AI analysis timed out. Retry with a smaller source set";
  if (truncated) return "AI review output reached the token limit before valid JSON was complete. Retry with a smaller source group";
  if (e?.name === "AI_NoObjectGeneratedError") {
    const causeName = (e.cause as ProviderError | undefined)?.name;
    const phase = causeName === "AI_JSONParseError" || causeName === "SyntaxError" ? "malformed JSON" : causeName === "AI_TypeValidationError" || causeName === "ZodError" ? "schema-invalid data" : "invalid structured data";
    const finish = ["stop", "length", "content-filter", "error", "other"].includes(e.finishReason || "") ? ` (finish: ${e.finishReason})` : "";
    return `AI returned ${phase}${finish}; retry with a smaller source group`;
  }
  if (e?.name === "AI_NoOutputGeneratedError") return "AI returned no review output; check model response limits and retry";
  if (e?.name === "ZodError" || e?.name === "AI_TypeValidationError") return "AI review fields did not match the required schema; retry with a smaller source group";
  if (e?.name === "SyntaxError" || e?.name === "AI_JSONParseError") return "AI returned malformed JSON review data; retry with a smaller source group";
  return "AI response could not be validated. Retry the review; static findings remain available";
}
