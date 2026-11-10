import { forbidden, redirect } from "next/navigation";
import { ADMIN_ROLE, roleFromClaims } from "@/lib/claims";
import { createClient } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email: string | null;
  /** Role dari `app_metadata` (server-set), bukan `user_metadata`. */
  role: string | null;
};

/**
 * User yang sedang login. `getClaims()` memverifikasi tanda tangan JWT
 * (JWKS Supabase) dan masa berlakunya, jadi role di sini tidak bisa dipalsuin
 * dari cookie.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) return null;

  return {
    id: data.claims.sub ?? "",
    email: data.claims.email ?? null,
    role: roleFromClaims(data.claims),
  };
}

/**
 * Guard admin untuk server action: anonim -> halaman login, non-admin -> 403.
 * Di area halaman, gerbang utamanya ada di `src/proxy.ts` (hanya dia yang bisa
 * mengirim status 307/403 sebelum render mulai).
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await getAuthUser();

  if (!user) redirect("/login");
  if (user.role !== ADMIN_ROLE) forbidden();

  return user;
}

/** Tujuan redirect setelah login: hanya path internal (anti open-redirect). */
export function safeRedirectPath(value: string | null | undefined): string {
  const path = value ?? "";
  const isInternal =
    path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");

  return isInternal ? path : "/admin";
}
