"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        background: "transparent",
        border: "1.5px solid var(--grey-200)",
        borderRadius: "var(--r)",
        padding: "10px 20px",
        fontSize: 13,
        color: "var(--grey-600)",
        cursor: "pointer",
        fontFamily: "var(--font-archivo), monospace",
      }}
    >
      Se déconnecter
    </button>
  );
}
