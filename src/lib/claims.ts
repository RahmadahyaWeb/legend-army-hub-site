// Klaim JWT Supabase: satu tempat membaca role, dipakai proxy (gerbang rute)
// dan DAL (server action) supaya dua gerbang tidak bisa berbeda baca.
//
// Role disimpan di `app_metadata` (server-set lewat admin API), bukan
// `user_metadata` yang bisa diubah user sendiri.

export const ADMIN_ROLE = "admin";

export type JwtClaims = {
  sub?: string;
  email?: string;
  app_metadata?: unknown;
};

/** Role dari klaim JWT, atau null kalau tidak ada / bentuknya tak terduga. */
export function roleFromClaims(claims: JwtClaims | null | undefined): string | null {
  const appMetadata = claims?.app_metadata;
  if (!appMetadata || typeof appMetadata !== "object") return null;

  const role = (appMetadata as { role?: unknown }).role;
  return typeof role === "string" ? role : null;
}

export function isAdminClaims(claims: JwtClaims | null | undefined): boolean {
  return roleFromClaims(claims) === ADMIN_ROLE;
}
