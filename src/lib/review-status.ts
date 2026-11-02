import type { ReviewStatus } from "@/lib/store/pull-request-reviews";

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  awaiting_review: "Awaiting review",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};
