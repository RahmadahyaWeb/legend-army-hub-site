export const instant = false;

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MEMBER_SORT_OPTIONS,
  getMemberDirectory,
  getMemberFilterOptions,
  parseMemberQuery,
  type SearchParams,
} from "@/lib/members";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function FilterSelect({
  id,
  label,
  name,
  value,
  options,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={name} defaultValue={value} className={selectClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default async function MembersDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = parseMemberQuery(await searchParams);
  const [members, options] = await Promise.all([
    getMemberDirectory(query),
    getMemberFilterOptions(),
  ]);

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Direktori Member
            </h1>
            <p className="text-muted-foreground">
              Cari member Legend Army, saring berdasarkan rank dan class, lalu
              urutkan sesuai kebutuhan.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Lihat lineup</Link>
          </Button>
        </div>

        <form
          method="get"
          action="/members"
          role="search"
          aria-label="Cari dan saring member"
          className="mb-6 grid grid-cols-1 gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="q">Cari nama</Label>
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder="Nama member…"
            />
          </div>

          <FilterSelect
            id="rank"
            name="rank"
            label="Rank guild"
            value={query.rank}
            options={[
              { value: "", label: "Semua rank" },
              ...options.ranks.map((rank) => ({ value: rank, label: rank })),
            ]}
          />

          <FilterSelect
            id="class"
            name="class"
            label="Class"
            value={query.className}
            options={[
              { value: "", label: "Semua class" },
              ...options.classes.map((item) => ({ value: item, label: item })),
            ]}
          />

          <FilterSelect
            id="online"
            name="online"
            label="Status"
            value={query.online}
            options={[
              { value: "all", label: "Semua status" },
              { value: "online", label: "Online" },
              { value: "offline", label: "Offline" },
            ]}
          />

          <FilterSelect
            id="sort"
            name="sort"
            label="Urutkan"
            value={query.sort}
            options={MEMBER_SORT_OPTIONS}
          />

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit">Terapkan</Button>
            <Button asChild variant="ghost">
              <Link href="/members">Reset</Link>
            </Button>
          </div>
        </form>

        <p className="mb-2 text-sm text-muted-foreground" data-testid="member-count">
          {members.length} member
        </p>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">
              Daftar member Legend Army beserta class, rank, gear score, status,
              kontribusi, dan tim lineup.
            </caption>
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Nama</th>
                <th scope="col" className="px-3 py-2 font-medium">Class</th>
                <th scope="col" className="px-3 py-2 font-medium">Rank</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Gear Score
                </th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Weekly
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Kontribusi mingguan
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Kontribusi total
                </th>
                <th scope="col" className="px-3 py-2 font-medium">Lineup</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    Tidak ada member yang cocok dengan pencarian ini.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr
                    key={member.id}
                    data-testid="member-row"
                    className="border-t border-border"
                  >
                    <td data-testid="member-name" className="px-3 py-2 font-medium">
                      {member.player_name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {member.class_name}
                    </td>
                    <td className="px-3 py-2">{member.guild_rank}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {member.gear_score.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={member.is_online ? "secondary" : "outline"}>
                        {member.is_online ? "Online" : "Offline"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {member.weekly.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {member.weekly_contribution.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {member.total_contribution.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2">
                      {member.teamPosition === null ? (
                        <span className="text-muted-foreground">
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">Belum masuk lineup</span>
                        </span>
                      ) : (
                        <Badge data-testid="lineup-badge">
                          Lineup · Tim {member.teamPosition}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
