import { getNavTreeAdmin } from "@/lib/nav-actions";
import { NavEditorClient } from "./nav-editor-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Navigation — Admin MS Adhésif" };

export default async function NavigationPage() {
  const tree = await getNavTreeAdmin();
  return <NavEditorClient initialTree={tree} />;
}
