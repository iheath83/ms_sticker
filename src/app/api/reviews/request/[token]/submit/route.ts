import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { submitReviewFromToken } from "@/lib/reviews/review-submission-service";
import type { SubmitReviewPayload } from "@/lib/reviews/review-types";

const attributeSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
});

const reviewItemSchema = z.object({
  type: z.enum(["product", "store"]),
  productId: z.string().uuid().optional(),
  productVariantId: z.string().uuid().optional(),
  orderItemId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(255).optional(),
  body: z.string().optional(),
  displayName: z.string().max(255).optional(),
  attributes: z.array(attributeSchema).optional(),
  mediaKeys: z.array(z.string()).optional(),
  consentForMarketing: z.boolean().optional(),
});

const submitSchema = z.array(reviewItemSchema).min(1);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // token in URL is the tokenHash directly
  const payload: SubmitReviewPayload[] = parsed.data.map((item) => {
    const p: SubmitReviewPayload = { type: item.type, rating: item.rating };
    if (item.productId !== undefined) p.productId = item.productId;
    if (item.productVariantId !== undefined) p.productVariantId = item.productVariantId;
    if (item.orderItemId !== undefined) p.orderItemId = item.orderItemId;
    if (item.title !== undefined) p.title = item.title;
    if (item.body !== undefined) p.body = item.body;
    if (item.displayName !== undefined) p.displayName = item.displayName;
    if (item.attributes !== undefined) p.attributes = item.attributes;
    if (item.mediaKeys !== undefined) p.mediaKeys = item.mediaKeys;
    if (item.consentForMarketing !== undefined) p.consentForMarketing = item.consentForMarketing;
    return p;
  });

  const result = await submitReviewFromToken(token, payload);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
