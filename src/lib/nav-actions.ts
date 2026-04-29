"use server";

import { db } from "@/db";
import { navItems } from "@/db/schema";
import { eq, isNull, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { NavItem } from "@/db/schema";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") throw new Error("Non autorisé");
}

// ── Public read (used by shop layout) ─────────────────────────────────────────

export interface NavItemWithChildren extends NavItem {
  children: NavItem[];
}

export async function getNavTree(): Promise<NavItemWithChildren[]> {
  try {
    const all = await db
      .select()
      .from(navItems)
      .where(eq(navItems.active, true))
      .orderBy(asc(navItems.sortOrder));

    const roots = all.filter((n) => !n.parentId);
    return roots.map((root) => ({
      ...root,
      children: all.filter((n) => n.parentId === root.id),
    }));
  } catch {
    return [];
  }
}

// ── Admin reads ────────────────────────────────────────────────────────────────

export async function getNavTreeAdmin(): Promise<NavItemWithChildren[]> {
  await requireAdmin();
  const all = await db
    .select()
    .from(navItems)
    .orderBy(asc(navItems.sortOrder));

  const roots = all.filter((n) => !n.parentId);
  return roots.map((root) => ({
    ...root,
    children: all.filter((n) => n.parentId === root.id),
  }));
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createNavItem(data: {
  parentId?: string | null;
  label: string;
  href: string;
  icon?: string | undefined;
  description?: string | undefined;
  badge?: string | undefined;
  openInNewTab?: boolean | undefined;
  sortOrder?: number | undefined;
}) {
  await requireAdmin();
  await db.insert(navItems).values({
    parentId:    data.parentId ?? null,
    label:       data.label,
    href:        data.href,
    icon:        data.icon ?? null,
    description: data.description ?? null,
    badge:       data.badge ?? null,
    openInNewTab: data.openInNewTab ?? false,
    sortOrder:   data.sortOrder ?? 0,
  });
  revalidatePath("/");
  revalidatePath("/admin/navigation");
}

export async function updateNavItem(id: string, data: {
  label?: string | undefined;
  href?: string | undefined;
  icon?: string | null | undefined;
  description?: string | null | undefined;
  badge?: string | null | undefined;
  openInNewTab?: boolean | undefined;
  active?: boolean | undefined;
  sortOrder?: number | undefined;
}) {
  await requireAdmin();
  await db.update(navItems).set({ ...data, updatedAt: new Date() }).where(eq(navItems.id, id));
  revalidatePath("/");
  revalidatePath("/admin/navigation");
}

export async function deleteNavItem(id: string) {
  await requireAdmin();
  await db.delete(navItems).where(eq(navItems.id, id));
  revalidatePath("/");
  revalidatePath("/admin/navigation");
}

export async function reorderNavItems(items: { id: string; sortOrder: number }[]) {
  await requireAdmin();
  await Promise.all(
    items.map((item) =>
      db.update(navItems).set({ sortOrder: item.sortOrder }).where(eq(navItems.id, item.id))
    )
  );
  revalidatePath("/");
  revalidatePath("/admin/navigation");
}

// ── Default nav seed (called once if table is empty) ──────────────────────────

export async function seedDefaultNav() {
  await requireAdmin();
  const existing = await db.select({ id: navItems.id }).from(navItems).where(isNull(navItems.parentId)).limit(1);
  if (existing.length > 0) return { ok: false, message: "Navigation déjà configurée" };

  const roots = [
    { label: "Accueil",   href: "/",        sortOrder: 0 },
    { label: "Produits",  href: "/products", sortOrder: 1 },
    { label: "Devis pro", href: "/devis",   sortOrder: 2 },
    { label: "Nuancier",  href: "/nuancier", sortOrder: 3 },
    { label: "FAQ",       href: "/faq",     sortOrder: 4 },
  ];

  const inserted = await db.insert(navItems).values(roots).returning({ id: navItems.id, label: navItems.label });

  const produits = inserted.find((r) => r.label === "Produits");
  if (produits) {
    await db.insert(navItems).values([
      { parentId: produits.id, label: "Tous les produits", href: "/products",           icon: "🏷️", description: "Voir l'ensemble du catalogue", sortOrder: 0 },
      { parentId: produits.id, label: "Die Cut",           href: "/products?material=vinyl",      icon: "✂️", description: "Découpe sur mesure",            sortOrder: 1 },
      { parentId: produits.id, label: "Holographiques",    href: "/products?material=holographic", icon: "✨", description: "Effet arc-en-ciel premium",      sortOrder: 2 },
      { parentId: produits.id, label: "Transparents",      href: "/products?material=transparent", icon: "💎", description: "Fond transparent discret",       sortOrder: 3 },
      { parentId: produits.id, label: "Configurateur",     href: "/custom-stickers",               icon: "⚙️", description: "Créez votre sticker sur-mesure", sortOrder: 4, badge: "NOUVEAU" },
    ]);
  }

  revalidatePath("/");
  revalidatePath("/admin/navigation");
  return { ok: true };
}
