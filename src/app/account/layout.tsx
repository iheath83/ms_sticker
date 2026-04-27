import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { CartProvider } from "@/components/shop/cart-context";
import { getActiveProducts } from "@/lib/products";
import AccountNav from "./account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?callbackUrl=/account/orders");

  const products = await getActiveProducts();

  return (
    <CartProvider>
      <Header products={products} />
      <CartDrawer />

      {/* Account sub-navigation */}
      <AccountNav user={{ name: session.user.name ?? null, email: session.user.email }} />

      {/* Content */}
      <div style={{ background: "var(--cream)", minHeight: "60vh" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>
          {children}
        </div>
      </div>

      <Footer />
    </CartProvider>
  );
}
