"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SLOTS_PER_TEAM, slotAssignError, TEAMS_PER_LINEUP } from "@/lib/lineup";

// Editor lineup (spec .scratch/guild-league-lineup/spec.md §4.6, US-2).
//
// Aturan slot ditegakkan database (PK team_position+slot_no, UNIQUE member_id),
// tapi action memeriksa dulu supaya pesannya bisa dimengerti admin. Race antar
// admin tetap ditangkap constraint dan dikembalikan sebagai error, bukan ditekan.

export type AssignResult =
  | { status: "ok"; memberId: string; teamPosition: number; slotNo: number }
  | { status: "error"; error: string };

export type UnassignResult =
  | { status: "ok"; memberId: string }
  | { status: "error"; error: string };

function isSlotInBounds(teamPosition: number, slotNo: number): boolean {
  return (
    Number.isInteger(teamPosition) &&
    teamPosition >= 1 &&
    teamPosition <= TEAMS_PER_LINEUP &&
    Number.isInteger(slotNo) &&
    slotNo >= 1 &&
    slotNo <= SLOTS_PER_TEAM
  );
}

function revalidateLineup() {
  revalidatePath("/");
  revalidatePath("/admin/lineup");
}

/** Assign member ke slot tim. Slot terisi / member sudah punya tim ditolak. */
export async function assignMemberAction(
  memberId: string,
  teamPosition: number,
  slotNo: number,
): Promise<AssignResult> {
  await requireAdmin();

  if (!memberId || !isSlotInBounds(teamPosition, slotNo)) {
    return { status: "error", error: "Slot tidak valid." };
  }

  const supabase = await createClient();

  const { data: member, error: memberError } = await supabase
    .from("guild_members")
    .select("id")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    return { status: "error", error: `Gagal memeriksa member: ${memberError.message}` };
  }
  if (!member) {
    return { status: "error", error: "Member tidak ditemukan." };
  }

  const { data: existing } = await supabase
    .from("lineup_slots")
    .select("team_position, slot_no")
    .eq("member_id", memberId)
    .maybeSingle();

  if (existing) {
    return {
      status: "error",
      error: `Member ini sudah ada di Tim ${existing.team_position}, slot ${existing.slot_no}.`,
    };
  }

  const { data: occupied } = await supabase
    .from("lineup_slots")
    .select("member_id")
    .eq("team_position", teamPosition)
    .eq("slot_no", slotNo)
    .maybeSingle();

  if (occupied) {
    return { status: "error", error: "Slot sudah terisi member lain." };
  }

  const { error } = await supabase
    .from("lineup_slots")
    .insert({ team_position: teamPosition, slot_no: slotNo, member_id: memberId });

  if (error) {
    return { status: "error", error: slotAssignError(error) };
  }

  revalidateLineup();

  return { status: "ok", memberId, teamPosition, slotNo };
}

/** Keluarkan member dari slotnya; slot menjadi kosong dan member balik ke pool. */
export async function unassignMemberAction(memberId: string): Promise<UnassignResult> {
  await requireAdmin();

  if (!memberId) {
    return { status: "error", error: "Member tidak ditemukan." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lineup_slots").delete().eq("member_id", memberId);

  if (error) {
    return { status: "error", error: `Gagal mengeluarkan member: ${error.message}` };
  }

  revalidateLineup();

  return { status: "ok", memberId };
}
