"use server";

import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // Pesan generik supaya tidak membocak email mana yang terdaftar.
  if (error) return { error: "Email atau password salah." };

  // Cookie sesi ditulis oleh klien SSR di dalam server action ini.
  redirect(next);
}
