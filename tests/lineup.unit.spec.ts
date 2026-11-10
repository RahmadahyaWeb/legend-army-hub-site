import { expect, test } from "@playwright/test";
import { groupByLane, SLOTS_PER_TEAM, slotAssignError, type LineupTeam } from "@/lib/lineup";

function team(position: number, lane: LineupTeam["lane"]): LineupTeam {
  return {
    position,
    lane,
    slots: Array.from({ length: SLOTS_PER_TEAM }, (_, index) => ({
      slotNo: index + 1,
      member: null,
    })),
  };
}

test("groupByLane mengelompokkan tim per lane dalam urutan top, mid, bot", () => {
  const groups = groupByLane([
    team(1, "top"),
    team(5, "mid"),
    team(2, "top"),
    team(9, "bot"),
  ]);

  expect(groups.map((group) => group.lane)).toEqual(["top", "mid", "bot"]);
  expect(groups[0].teams.map((t) => t.position)).toEqual([1, 2]);
  expect(groups[1].teams.map((t) => t.position)).toEqual([5]);
  expect(groups[2].teams.map((t) => t.position)).toEqual([9]);
});

test("lane tanpa tim tetap muncul supaya ringkasan jumlah tim per lane lengkap", () => {
  const groups = groupByLane([team(1, "top")]);

  expect(groups).toHaveLength(3);
  expect(groups.find((group) => group.lane === "bot")?.teams).toEqual([]);
});

// Race antar admin: constraint database adalah sumber kebenaran, jadi pesannya
// dipetakan dari SQLSTATE + nama constraint, bukan dari teks bebas PostgREST.
test("pelanggaran constraint dipetakan ke pesan yang bisa dimengerti", () => {
  expect(
    slotAssignError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "lineup_slots_member_id_key"',
    }),
  ).toBe("Member ini sudah ada di tim lain.");

  expect(
    slotAssignError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "lineup_slots_pkey"',
    }),
  ).toBe("Slot sudah terisi member lain.");

  expect(
    slotAssignError({
      code: "23503",
      message:
        'insert or update on table "lineup_slots" violates foreign key constraint "lineup_slots_member_id_fkey"',
    }),
  ).toBe("Member tidak ditemukan.");

  expect(slotAssignError({ code: "XX000", message: "boom" })).toBe(
    "Gagal menyimpan: boom",
  );
});
