import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, customerProfiles, addresses, orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const [profile] = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, id)).limit(1);
  const userAddresses = await db.select().from(addresses).where(eq(addresses.userId, id));
  const userOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, id))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return NextResponse.json({ user, profile: profile ?? null, addresses: userAddresses, orders: userOrders });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    email?: string;
    phone?: string;
    role?: "customer" | "admin";
    tags?: string[];
    notes?: string;
    profile?: {
      isProfessional?: boolean;
      companyName?: string;
      vatNumber?: string;
      siret?: string;
    };
  };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Update user fields
  const userPatch: Partial<typeof users.$inferInsert> = {};
  if (body.name !== undefined) userPatch.name = body.name;
  if (body.email !== undefined) userPatch.email = body.email;
  if (body.phone !== undefined) userPatch.phone = body.phone;
  if (body.role !== undefined) userPatch.role = body.role;
  if (body.tags !== undefined) userPatch.tags = body.tags;
  if (body.notes !== undefined) userPatch.notes = body.notes;

  let updatedUser = null;
  if (Object.keys(userPatch).length > 0) {
    const [u] = await db.update(users).set(userPatch).where(eq(users.id, id)).returning();
    updatedUser = u;
  } else {
    const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    updatedUser = u;
  }

  // Upsert customer profile if provided
  let updatedProfile = null;
  if (body.profile !== undefined) {
    const [existing_profile] = await db.select({ id: customerProfiles.id }).from(customerProfiles).where(eq(customerProfiles.userId, id)).limit(1);
    if (existing_profile) {
      const [p] = await db.update(customerProfiles).set(body.profile).where(eq(customerProfiles.userId, id)).returning();
      updatedProfile = p;
    } else {
      const [p] = await db.insert(customerProfiles).values({ userId: id, ...body.profile }).returning();
      updatedProfile = p;
    }
  }

  return NextResponse.json({ user: updatedUser, profile: updatedProfile });
}
