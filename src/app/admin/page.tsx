import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="admin-title">
          Area Admin
        </h1>
        <p className="text-muted-foreground">
          Import CSV member dan menyusun lineup Guild League akan tersedia di
          sini.
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
              <Badge variant="outline" className="mt-0.5 shrink-0">
                Segera
              </Badge>
              <span className="text-foreground">
                Import CSV member (ticket 03).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">
                Segera
              </Badge>
              <span className="text-foreground">
                Editor lineup drag &amp; drop (ticket 04).
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
