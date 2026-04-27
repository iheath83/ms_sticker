import { notFound } from "next/navigation";
import { getCategoryById, getCategories } from "@/lib/product-catalog-actions";
import { CategoryEditClient } from "@/components/admin/category-edit-client";

export default async function CategoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";

  const [category, allCategories] = await Promise.all([
    isNew ? null : getCategoryById(id),
    getCategories(),
  ]);

  if (!isNew && !category) notFound();

  const parents = allCategories.filter((c) => c.id !== id);

  return (
    <CategoryEditClient
      category={
        category
          ? {
              id: category.id,
              name: category.name,
              slug: category.slug,
              description: category.description,
              imageUrl: category.imageUrl,
              parentId: category.parentId,
              sortOrder: category.sortOrder,
              active: category.active,
            }
          : null
      }
      parents={parents.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
