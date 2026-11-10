import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

// Direktori member publik (spec .scratch/guild-league-lineup/spec.md US-5):
// cari/saring/urutkan dieksekusi sebagai query Postgres, bukan menyaring data
// yang sudah dimuat ke browser.

export type MemberSort =
  | "gear"
  | "weekly"
  | "weekly_contribution"
  | "total_contribution"
  | "name"
  | "name_desc";

const SORTS: Record<MemberSort, { column: string; ascending: boolean }> = {
  gear: { column: "gear_score", ascending: false },
  weekly: { column: "weekly", ascending: false },
  weekly_contribution: { column: "weekly_contribution", ascending: false },
  total_contribution: { column: "total_contribution", ascending: false },
  name: { column: "player_name", ascending: true },
  name_desc: { column: "player_name", ascending: false },
};

export const MEMBER_SORT_OPTIONS: { value: MemberSort; label: string }[] = [
  { value: "gear", label: "Gear Score (tertinggi)" },
  { value: "weekly", label: "Weekly (tertinggi)" },
  { value: "weekly_contribution", label: "Kontribusi mingguan (tertinggi)" },
  { value: "total_contribution", label: "Kontribusi total (tertinggi)" },
  { value: "name", label: "Nama A–Z" },
  { value: "name_desc", label: "Nama Z–A" },
];

export type OnlineFilter = "all" | "online" | "offline";

export type MemberQuery = {
  q: string;
  rank: string;
  className: string;
  online: OnlineFilter;
  sort: MemberSort;
};

export type SearchParams = Record<string, string | string[] | undefined>;

/** Nilai search param tunggal, di-trim; nilai berulang diambil yang pertama. */
function readParam(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Param URL tidak trusted: nilai asing jatuh ke default, bukan error 500. */
export function parseMemberQuery(params: SearchParams): MemberQuery {
  const sort = readParam(params, "sort");
  const online = readParam(params, "online");

  return {
    q: readParam(params, "q"),
    rank: readParam(params, "rank"),
    className: readParam(params, "class"),
    online: online === "online" || online === "offline" ? online : "all",
    sort: Object.hasOwn(SORTS, sort) ? (sort as MemberSort) : "gear",
  };
}

/** `%` dan `_` adalah wildcard ILIKE; nama member boleh memuatnya. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export type DirectoryMember = Pick<
  Tables<"guild_members">,
  | "id"
  | "player_name"
  | "class_name"
  | "guild_rank"
  | "gear_score"
  | "weekly"
  | "weekly_contribution"
  | "total_contribution"
  | "is_online"
> & {
  /** Posisi tim kalau member punya slot lineup, null kalau belum. */
  teamPosition: number | null;
};

export async function getMemberDirectory(
  query: MemberQuery,
): Promise<DirectoryMember[]> {
  const supabase = await createClient();

  let members = supabase
    .from("guild_members")
    .select(
      "id, player_name, class_name, guild_rank, gear_score, weekly, weekly_contribution, total_contribution, is_online",
    );

  if (query.q) {
    members = members.ilike("player_name", `%${escapeLike(query.q)}%`);
  }
  if (query.rank) members = members.eq("guild_rank", query.rank);
  if (query.className) members = members.eq("class_name", query.className);
  if (query.online !== "all") {
    members = members.eq("is_online", query.online === "online");
  }

  const sort = SORTS[query.sort];
  const [membersResult, slotsResult] = await Promise.all([
    members.order(sort.column, { ascending: sort.ascending }),
    supabase.from("lineup_slots").select("member_id, team_position"),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (slotsResult.error) throw slotsResult.error;

  const teamByMember = new Map<string, number>();
  for (const slot of slotsResult.data) {
    teamByMember.set(slot.member_id, slot.team_position);
  }

  return membersResult.data.map((member) => ({
    ...member,
    teamPosition: teamByMember.get(member.id) ?? null,
  }));
}

export type MemberFilterOptions = { ranks: string[]; classes: string[] };

/** Pilihan dropdown diambil dari data, bukan daftar hardcoded: rank & class
 *  berasal dari CSV yang bisa berubah. Hanya dua kolom, bukan seluruh baris. */
export async function getMemberFilterOptions(): Promise<MemberFilterOptions> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("guild_members")
    .select("guild_rank, class_name");

  if (error) throw error;

  const distinct = (values: string[]) =>
    [...new Set(values)].sort((a, b) => a.localeCompare(b));

  return {
    ranks: distinct(data.map((row) => row.guild_rank)),
    classes: distinct(data.map((row) => row.class_name)),
  };
}
