import { HttpError } from "./security.js";

// Never expose provider response bodies, request headers, or credentials.
export function aiFailureMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  const e = error as { statusCode?: number; name?: string; cause?: { statusCode?: number } } | null;
  const status = e?.statusCode ?? e?.cause?.statusCode;
  if (status === 429) return "AI quota or rate limit reached. Check the provider quota and retry later";
  if (status === 401 || status === 403) return "AI credentials or model access were rejected. Check the server's Gemini configuration";
  if (status === 404) return "The configured AI model is unavailable. Check GEMINI_MODEL on the server";
  if (status && status >= 500) return "The AI provider is temporarily unavailable. Retry later";
  if (e?.name === "TimeoutError" || e?.name === "AbortError") return "AI analysis timed out. Retry with a smaller source set";
  return "AI response could not be validated. Retry the review; static findings remain available";
}
