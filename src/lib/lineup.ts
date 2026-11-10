import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";

export type Lane = Enums<"member_lane">;

export const LANES = ["top", "mid", "bot"] as const satisfies readonly Lane[];

export const SLOTS_PER_TEAM = 5;

export const TEAMS_PER_LINEUP = 12;

export type LineupMember = Pick<
  Tables<"guild_members">,
  "id" | "player_name" | "class_name" | "guild_rank" | "gear_score"
>;

export type LineupSlot = { slotNo: number; member: LineupMember | null };

export type LineupTeam = {
  position: number;
  lane: Lane;
  slots: LineupSlot[];
};

export type LineupLaneGroup = { lane: Lane; teams: LineupTeam[] };

/** Kelompokkan tim per lane, urutan top → mid → bot. Lane tanpa tim tetap
 *  muncul (kosong) supaya ringkasan jumlah tim per lane selalu lengkap. */
export function groupByLane(teams: LineupTeam[]): LineupLaneGroup[] {
  return LANES.map((lane) => ({
    lane,
    teams: teams.filter((team) => team.lane === lane),
  }));
}

/** Kunci slot lineup: satu member maksimal satu tim. */
const slotKey = (teamPosition: number, slotNo: number) => `${teamPosition}:${slotNo}`;

/** Pelanggaran constraint saat assign -> pesan yang bisa dimengerti admin.
 *  Kode SQLSTATE dipakai, bukan teks bebas; nama constraint membedakan
 *  "member dobel" (lineup_slots_member_id_key) dari "slot dobel" (pkey). */
export function slotAssignError(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return error.message.includes("member_id")
      ? "Member ini sudah ada di tim lain."
      : "Slot sudah terisi member lain.";
  }
  if (error.code === "23503") {
    return "Member tidak ditemukan.";
  }
  return `Gagal menyimpan: ${error.message}`;
}

/** Member di panel pool + posisi slotnya (null = belum punya tim). */
export type PoolMember = LineupMember & {
  teamPosition: number | null;
  slotNo: number | null;
};

/** Panel pool: seluruh member guild, diurutkan nama, lengkap dengan slotnya. */
export async function getPoolMembers(): Promise<PoolMember[]> {
  const supabase = await createClient();

  const [membersResult, slotsResult] = await Promise.all([
    supabase
      .from("guild_members")
      .select("id, player_name, class_name, guild_rank, gear_score")
      .order("player_name"),
    supabase.from("lineup_slots").select("team_position, slot_no, member_id"),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (slotsResult.error) throw slotsResult.error;

  const slotByMember = new Map<string, { teamPosition: number; slotNo: number }>();
  for (const slot of slotsResult.data) {
    slotByMember.set(slot.member_id, {
      teamPosition: slot.team_position,
      slotNo: slot.slot_no,
    });
  }

  return membersResult.data.map((member) => ({
    ...member,
    ...(slotByMember.get(member.id) ?? { teamPosition: null, slotNo: null }),
  }));
}

/** Lineup aktif: 12 tim + 5 slot per tim (slot tanpa member = null). */
export async function getLineup(): Promise<LineupTeam[]> {
  const supabase = await createClient();

  const [teamsResult, slotsResult] = await Promise.all([
    supabase.from("teams").select("position, lane").order("position"),
    supabase
      .from("lineup_slots")
      .select(
        "team_position, slot_no, member:guild_members(id, player_name, class_name, guild_rank, gear_score)",
      )
      .order("slot_no"),
  ]);

  if (teamsResult.error) throw teamsResult.error;
  if (slotsResult.error) throw slotsResult.error;

  const memberBySlot = new Map<string, LineupMember | null>();
  for (const slot of slotsResult.data) {
    memberBySlot.set(slotKey(slot.team_position, slot.slot_no), slot.member);
  }

  return teamsResult.data.map((team) => ({
    position: team.position,
    lane: team.lane,
    slots: Array.from({ length: SLOTS_PER_TEAM }, (_, index) => ({
      slotNo: index + 1,
      member: memberBySlot.get(slotKey(team.position, index + 1)) ?? null,
    })),
  }));
}
