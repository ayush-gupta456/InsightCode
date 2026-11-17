import type { Review } from "./types.js";

export const ANALYSIS_VERSION = "java-shortest-path-v2";

/** A requested but incomplete AI pass must never look like a perfect review. */
export function hasCompleteRequestedAnalysis(review: Pick<Review, "ai" | "aiStatus">) {
  return !review.ai || review.aiStatus === "completed";
}
export function displayedReviewScore(review: Pick<Review, "ai" | "aiStatus" | "status" | "score">) {
  return review.status === "completed" && hasCompleteRequestedAnalysis(review) ? review.score : undefined;
}
