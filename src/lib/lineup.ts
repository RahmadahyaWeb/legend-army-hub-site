import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";

export type Lane = Enums<"member_lane">;

export const LANES = ["top", "mid", "bot"] as const satisfies readonly Lane[];

export const SLOTS_PER_TEAM = 5;

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
