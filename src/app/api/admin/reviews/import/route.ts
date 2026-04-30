import { NextRequest, NextResponse } from "next/server";
import { importReviewsFromCSV } from "@/lib/review-actions";
import { z } from "zod";

const rowSchema = z.object({
  type: z.enum(["product", "store"]),
  productId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().optional(),
  body: z.string().optional(),
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  createdAt: z.string().optional(),
});

const importSchema = z.array(rowSchema);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

    const rows = parsed.data.map((row) => {
    const r: Parameters<typeof importReviewsFromCSV>[0][number] = {
      type: row.type,
      rating: row.rating,
      customerEmail: row.customerEmail,
    };
    if (row.productId !== undefined) r.productId = row.productId;
    if (row.title !== undefined) r.title = row.title;
    if (row.body !== undefined) r.body = row.body;
    if (row.customerName !== undefined) r.customerName = row.customerName;
    if (row.createdAt !== undefined) r.createdAt = row.createdAt;
    return r;
  });

  const result = await importReviewsFromCSV(rows);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 400 });
  }
}
