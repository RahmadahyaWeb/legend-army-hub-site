import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function AdminPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="admin-title">
          Area Admin
        </h1>
        <p className="text-muted-foreground">
          Import CSV member dan menyusun lineup Guild League dikelola dari sini.
        </p>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base">Yang sudah tersedia</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                Aktif
              </Badge>
              <span className="text-foreground">
                Proteksi area admin (login + role admin + RLS write).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                Aktif
              </Badge>
              <Link
                href="/admin/members"
                className="text-foreground underline underline-offset-4"
              >
                Import CSV member (ticket 03).
              </Link>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                Aktif
              </Badge>
              <Link
                href="/admin/lineup"
                className="text-foreground underline underline-offset-4"
              >
                Editor lineup drag &amp; drop (ticket 04).
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
