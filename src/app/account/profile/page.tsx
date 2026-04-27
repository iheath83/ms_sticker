import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfileClient from "./profile-client";

export const metadata = { title: "Mon compte" };

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?callbackUrl=/account/profile");

  return (
    <ProfileClient
      user={{
        name: session.user.name ?? "",
        email: session.user.email,
      }}
    />
  );
}
