export const instant = false;

import { getLineup, getPoolMembers } from "@/lib/lineup";
import { LineupEditor } from "./lineup-editor";

export default async function AdminLineupPage() {
  const [teams, pool] = await Promise.all([getLineup(), getPoolMembers()]);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1
          className="text-2xl font-bold tracking-tight"
          data-testid="lineup-editor-title"
        >
          Editor Lineup
        </h1>
        <p className="text-muted-foreground">
          Seret member dari pool ke slot tim, atau klik member lalu klik slot
          kosong. Setiap perubahan tersimpan otomatis.
        </p>
      </div>

      <LineupEditor teams={teams} pool={pool} />
    </section>
  );
}
