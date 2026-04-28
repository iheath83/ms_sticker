// All admin pages are always dynamic — they require auth and never need static generation
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
