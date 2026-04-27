import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserAddresses } from "@/lib/address-actions";
import AddressesClient from "./addresses-client";

export const metadata = { title: "Mes adresses" };

export default async function AddressesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?callbackUrl=/account/addresses");

  const addresses = await getUserAddresses();

  return <AddressesClient initialAddresses={addresses} />;
}
