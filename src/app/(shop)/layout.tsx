import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { CartProvider } from "@/components/shop/cart-context";
import { CookieBanner } from "@/components/shop/cookie-banner";
import { getActiveProducts } from "@/lib/products";
import { getSiteSettings } from "@/lib/settings-actions";

const BYPASS_COOKIE = "ms_admin_bypass";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  // Check maintenance mode — bypass for admins
  const cookieStore = await cookies();
  const hasBypass = !!cookieStore.get(BYPASS_COOKIE);

  if (!hasBypass) {
    const settings = await getSiteSettings();
    if (settings.maintenanceEnabled) {
      redirect("/maintenance");
    }
  }

  const [products, settings] = await Promise.all([
    getActiveProducts().catch(() => []),
    getSiteSettings(),
  ]);

  return (
    <CartProvider>
      <Header products={products} logoUrl={settings.logoUrl} />
      {children}
      <Footer logoUrl={settings.logoUrl} />
      <CartDrawer />
      <CookieBanner />
    </CartProvider>
  );
}
