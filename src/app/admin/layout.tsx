import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Gerbang utama ada di `src/proxy.ts` (status 307/403 yang benar). Pengecekan
  // di sini adalah lapisan kedua untuk server action & route yang lolos proxy.
  const user = await requireAdmin();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b bg-muted/30">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p
              className="truncate text-sm font-medium text-foreground"
              data-testid="admin-email"
            >
              {user.email}
            </p>
            <p className="text-xs text-muted-foreground">
              Legend Army Hub — Admin
            </p>
          </div>
          <form action={signOutAction} className="shrink-0">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Keluar
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
