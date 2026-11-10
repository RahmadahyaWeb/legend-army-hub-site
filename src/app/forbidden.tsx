import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// UI 403 di dalam aplikasi (dipakai kalau `forbidden()` dilempar dari server
// action). Respons 403 untuk akses halaman dibuat `src/proxy.ts` — body-nya
// HTML mandiri, karena status harus dikirim sebelum render mulai.
export default function Forbidden() {
  return (
    <main
      data-testid="forbidden"
      className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-7xl font-bold tracking-tighter text-muted-foreground/30">
            403
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Akses ditolak</h1>
        </div>
        <p className="text-muted-foreground">
          Akun yang sedang login bukan admin Legend Army, jadi area ini tidak
          bisa dibuka.
        </p>
        <Button asChild variant="outline">
          <Link href="/" className="gap-2">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke lineup publik
          </Link>
        </Button>
      </div>
    </main>
  );
}
