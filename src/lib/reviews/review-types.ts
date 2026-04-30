// ─── Review Types ─────────────────────────────────────────────────────────────

export type ReviewStatus = "pending" | "published" | "rejected" | "archived";
export type ReviewVerificationStatus =
  | "verified_purchase"
  | "unverified"
  | "manual_verified"
  | "imported";
export type ReviewSource =
  | "post_purchase_email"
  | "manual_request"
  | "onsite_form"
  | "import"
  | "admin";
export type ReviewType = "product" | "store";
export type ReviewRequestStatus =
  | "scheduled"
  | "sent"
  | "opened"
  | "clicked"
  | "submitted"
  | "expired"
  | "cancelled";
export type ReviewRequestType = "product" | "store" | "combined";
export type ReviewMediaType = "image" | "video";
export type ReviewMediaStatus = "pending" | "approved" | "rejected";
export type ReviewRequestItemStatus = "pending" | "submitted" | "skipped";

// ─── DB Row shapes ─────────────────────────────────────────────────────────────

export interface ReviewRow {
  id: string;
  type: ReviewType;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  verificationStatus: ReviewVerificationStatus;
  productId: string | null;
  productVariantId: string | null;
  orderId: string | null;
  orderItemId: string | null;
  customerId: string | null;
  customerEmail: string;
  customerName: string | null;
  displayName: string | null;
  source: ReviewSource;
  locale: string | null;
  helpfulCount: number;
  notHelpfulCount: number;
  publishedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewMediaRow {
  id: string;
  reviewId: string;
  type: ReviewMediaType;
  url: string;
  thumbnailUrl: string | null;
  storageKey: string;
  status: ReviewMediaStatus;
  altText: string | null;
  caption: string | null;
  consentForMarketing: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewRequestRow {
  id: string;
  orderId: string | null;
  customerId: string | null;
  customerEmail: string;
  type: ReviewRequestType;
  tokenHash: string;
  status: ReviewRequestStatus;
  sendAt: Date;
  sentAt: Date | null;
  firstOpenedAt: Date | null;
  firstClickedAt: Date | null;
  submittedAt: Date | null;
  expiresAt: Date;
  reminderCount: number;
  nextReminderAt: Date | null;
  locale: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewRequestItemRow {
  id: string;
  reviewRequestId: string;
  productId: string | null;
  productVariantId: string | null;
  orderItemId: string | null;
  status: ReviewRequestItemStatus;
  reviewId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewAggregateRow {
  id: string;
  targetType: ReviewType;
  targetId: string | null;
  averageRating: number;
  reviewCount: number;
  rating1Count: number;
  rating2Count: number;
  rating3Count: number;
  rating4Count: number;
  rating5Count: number;
  mediaReviewCount: number;
  verifiedReviewCount: number;
  updatedAt: Date;
}

export interface ReviewSettingsRow {
  id: number;
  autoPublish: boolean;
  autoPublishMinRating: number | null;
  requestDelayDaysAfterFulfillment: number;
  requestExpiresAfterDays: number;
  remindersEnabled: boolean;
  firstReminderDelayDays: number;
  secondReminderDelayDays: number | null;
  maxReminderCount: number;
  collectStoreReview: boolean;
  collectProductReviews: boolean;
  collectMedia: boolean;
  requireModerationForMedia: boolean;
  requireModerationForLowRating: boolean;
  lowRatingThreshold: number;
  displayReviewerLastName: boolean;
  displayVerifiedBadge: boolean;
  updatedAt: Date;
}

export interface ReviewReplyRow {
  id: string;
  reviewId: string;
  body: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── API / Service payloads ────────────────────────────────────────────────────

export interface SubmitReviewPayload {
  type: ReviewType;
  productId?: string | undefined;
  productVariantId?: string | undefined;
  orderItemId?: string | undefined;
  rating: number;
  title?: string | undefined;
  body?: string | undefined;
  displayName?: string | undefined;
  attributes?: Array<{ key: string; label: string; value: string }> | undefined;
  mediaKeys?: string[] | undefined;
  consentForMarketing?: boolean | undefined;
  storeReview?: {
    rating: number;
    title?: string | undefined;
    body?: string | undefined;
  } | undefined;
}

export interface ReviewRequestPageData {
  request: ReviewRequestRow;
  items: Array<
    ReviewRequestItemRow & {
      product: { id: string; name: string; imageUrl: string | null; slug: string } | null;
    }
  >;
}

export interface ReviewWithDetails extends ReviewRow {
  media: ReviewMediaRow[];
  reply: ReviewReplyRow | null;
  attributes: Array<{ id: string; key: string; label: string; value: string }>;
  product: { id: string; name: string; slug: string; imageUrl: string | null } | null;
  orderRef: string | null;
}

export interface AdminReviewFilters {
  status?: ReviewStatus | undefined;
  type?: ReviewType | undefined;
  rating?: number | undefined;
  withMedia?: boolean | undefined;
  productId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  q?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface AdminReviewRequestFilters {
  status?: ReviewRequestStatus | undefined;
  orderId?: string | undefined;
  q?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface ImportReviewRow {
  type: ReviewType;
  productId?: string | undefined;
  rating: number;
  title?: string | undefined;
  body?: string | undefined;
  customerEmail: string;
  customerName?: string | undefined;
  createdAt?: string | undefined;
}

export interface ReviewHelpfulVote {
  reviewId: string;
  helpful: boolean;
}
