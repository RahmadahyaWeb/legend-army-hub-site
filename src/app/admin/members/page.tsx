export const instant = false;

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImportForm } from "./import-form";

export default function MembersImportPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Import Member</h1>
        <p className="text-muted-foreground">
          Upload file CSV export guild untuk mengganti seluruh data member yang
          ada.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
          <CardDescription>
            File harus memiliki 12 kolom sesuai format export guild.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>
    </section>
  );
}
