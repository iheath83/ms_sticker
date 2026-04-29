import { getNavTreeAdmin } from "@/lib/nav-actions";
import { getPagesForNavPicker } from "@/lib/pages-actions";
import { NavEditorClient } from "./nav-editor-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Navigation — Admin MS Adhésif" };

export default async function NavigationPage() {
  const [tree, cmsPages] = await Promise.all([
    getNavTreeAdmin(),
    getPagesForNavPicker(),
  ]);
  return <NavEditorClient initialTree={tree} cmsPages={cmsPages} />;
}
