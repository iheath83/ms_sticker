"use client";

import { useEffect } from "react";
import { setAdminBypassCookie } from "@/lib/settings-actions";

export function AdminBypassCookieSetter() {
  useEffect(() => {
    setAdminBypassCookie();
  }, []);
  return null;
}
