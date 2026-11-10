import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { CSV_COLUMNS, MAX_IMPORT_ROWS, parseMemberCsv } from "@/lib/csv";

// Unit test parser CSV (spec .scratch/guild-league-lineup/spec.md §4.3).
// Parser murni, jadi tidak butuh database.

const HEADER = CSV_COLUMNS.join(",");

type Row = Partial<Record<(typeof CSV_COLUMNS)[number], string>>;

function fullRow(overrides: Row = {}): Row {
  return {
    Id: "1",
    Player: "XKAGE",
    "Lv.": "93",
    Class: "High Priest",
    Title: "Pathfinder IV",
    Gender: "M",
    Position: "WARLORD",
    "Gear Score": "78841",
    Weekly: "175",
    "Weekly Contribution": "227",
    "Total Contribution": "40093",
    "Online Status": "[Online]",
    ...overrides,
  };
}

function toCsv(rows: Row[], { bom = false, eol = "\n" } = {}): string {
  const body = rows
    .map((row) => CSV_COLUMNS.map((column) => row[column] ?? "").join(","))
    .join(eol);

  return `${bom ? "\uFEFF" : ""}${HEADER}${eol}${body}${eol}`;
}

test("file dengan BOM UTF-8 dan line ending CRLF diterima", () => {
  const result = parseMemberCsv(
    toCsv([fullRow({ Player: "ミLuuk丶Maw" })], { bom: true, eol: "\r\n" }),
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.members).toHaveLength(1);
  expect(result.members[0].playerName).toBe("ミLuuk丶Maw");
  expect(result.members[0].gearScore).toBe(78841);
  expect(result.members[0].guildRank).toBe("WARLORD");
});

test("BOM tidak ikut jadi nama kolom pertama", () => {
  const result = parseMemberCsv(`\uFEFF${HEADER}\n1,XKAGE,93,C,T,M,WARLORD,1,1,1,1,[Online]\n`);

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.members).toHaveLength(1);
});

test("header yang tidak cocok menolak seluruh file dan menyebut kolom bermasalah", () => {
  const header = CSV_COLUMNS.filter((column) => column !== "Gear Score").join(",");
  const result = parseMemberCsv(`${header}\n1,XKAGE,93,C,T,M,WARLORD,1,1,1,1,[Online]\n`);

  expect(result.ok).toBe(false);
  if (result.ok) return;

  expect(result.missing).toEqual(["Gear Score"]);
  expect(result.error).toContain("Gear Score");
});

test("kolom tak dikenal juga menolak file", () => {
  const result = parseMemberCsv(`${HEADER},Nickname\n1,XKAGE,93,C,T,M,WARLORD,1,1,1,1,[Online],x\n`);

  expect(result.ok).toBe(false);
  if (result.ok) return;

  expect(result.unexpected).toEqual(["Nickname"]);
  expect(result.error).toContain("Nickname");
});

test("nama kolom dicocokkan case-insensitive dan bebas urutan", () => {
  const header = [...CSV_COLUMNS].reverse().join(",");
  const values = [...CSV_COLUMNS]
    .reverse()
    .map((column) => fullRow()[column] ?? "")
    .join(",");

  const result = parseMemberCsv(`  ${header.toLowerCase()}  \n${values}\n`);

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.members).toHaveLength(1);
  expect(result.members[0].playerName).toBe("XKAGE");
  expect(result.members[0].level).toBe(93);
});

test("baris non-numerik ditolak per baris, baris lain tetap diterima", () => {
  const result = parseMemberCsv(
    toCsv([
      fullRow({ Player: "Satu" }),
      fullRow({ Id: "2", Player: "Dua", "Gear Score": "abc" }),
      fullRow({ Id: "3", Player: "Tiga" }),
    ]),
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.members.map((m) => m.playerName)).toEqual(["Satu", "Tiga"]);
  expect(result.rejected).toHaveLength(1);
  expect(result.rejected[0].rowNumber).toBe(3);
  expect(result.rejected[0].playerName).toBe("Dua");
  expect(result.rejected[0].reason).toContain("Gear Score");
});

test("baris dengan jumlah kolom tidak sesuai ditolak per baris", () => {
  const text = `${HEADER}\n1,XKAGE,93,C,T,M,WARLORD,1,1,1,1,[Online]\n2,Dua,93\n3,Tiga,93,C,T,M,WARLORD,1,1,1,1,[Online]\n`;

  const result = parseMemberCsv(text);

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.members.map((m) => m.playerName)).toEqual(["XKAGE", "Tiga"]);
  expect(result.rejected).toHaveLength(1);
  expect(result.rejected[0].rowNumber).toBe(3);
  expect(result.rejected[0].reason).toContain("jumlah kolom");
});

test("Player duplikat ditolak dengan alasan duplicate player name", () => {
  const result = parseMemberCsv(
    toCsv([
      fullRow({ Player: "Killua" }),
      fullRow({ Id: "2", Player: "killua" }),
      fullRow({ Id: "3", Player: "Lain" }),
    ]),
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.members.map((m) => m.playerName)).toEqual(["Killua", "Lain"]);
  expect(result.rejected).toHaveLength(1);
  expect(result.rejected[0].reason).toBe("duplicate player name");
});

test("baris tanpa nama player ditolak", () => {
  const result = parseMemberCsv(toCsv([fullRow({ Player: "" })]));

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.members).toHaveLength(0);
  expect(result.rejected[0].reason).toContain("nama player kosong");
});

test("file dengan lebih dari 2000 baris ditolak utuh", () => {
  const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, index) =>
    fullRow({ Id: String(index + 1), Player: `Member${index + 1}` }),
  );

  const result = parseMemberCsv(toCsv(rows));

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error).toContain("2000");
});

test("baris dengan kutip yang tidak ditutup ditolak per baris", () => {
  const result = parseMemberCsv(`${HEADER}\n1,"XKAGE,93\n`);

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.members).toHaveLength(0);
  expect(result.rejected[0].reason).toContain("tidak bisa dibaca");
});

test("file yang bukan UTF-8 ditolak dengan pesan jelas", () => {
  const result = parseMemberCsv(`${HEADER}\n1,XKAGE\uFFFD,93\n`);

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error).toContain("UTF-8");
});

test("nama dengan karakter non-Latin dan emoji tetap utuh", () => {
  const names = ["ミLuuk丶Maw", "Killuaツ", "Bopi剥皮", "Ranger🌟"];

  const result = parseMemberCsv(
    toCsv(names.map((name, index) => fullRow({ Id: String(index + 1), Player: name }))),
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.members.map((m) => m.playerName)).toEqual(names);
});

test("fixture import.csv: 148 baris diterima, 0 ditolak", () => {
  const result = parseMemberCsv(readFileSync("import.csv", "utf8"));

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.members).toHaveLength(148);
  expect(result.rejected).toHaveLength(0);
});
