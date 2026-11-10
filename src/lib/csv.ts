import Papa from "papaparse";

// Kontrak CSV file export guild (spec .scratch/guild-league-lineup/spec.md §4.3).
// Parser ini murni (tanpa I/O) supaya bisa diuji tanpa database.

/** 12 kolom wajib. Urutan di file bebas; pencocokan nama case-insensitive + trim. */
export const CSV_COLUMNS = [
  "Id",
  "Player",
  "Lv.",
  "Class",
  "Title",
  "Gender",
  "Position",
  "Gear Score",
  "Weekly",
  "Weekly Contribution",
  "Total Contribution",
  "Online Status",
] as const;

/** Batas server-side (AC1.8): file > 5 MB atau > 2000 baris data ditolak. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

/** Kolom yang wajib berisi bilangan bulat (AC1.3). */
const NUMERIC_COLUMNS = [
  "Lv.",
  "Gear Score",
  "Weekly",
  "Weekly Contribution",
  "Total Contribution",
] as const;

export type MemberRow = {
  sourceId: number | null;
  playerName: string;
  level: number;
  className: string;
  title: string;
  gender: string;
  guildRank: string;
  gearScore: number;
  weekly: number;
  weeklyContribution: number;
  totalContribution: number;
  onlineStatus: string;
};

export type RejectedRow = {
  /** Nomor baris data di file (baris 1 = header). */
  rowNumber: number;
  playerName: string;
  reason: string;
};

export type CsvParseError = {
  ok: false;
  error: string;
  missing: string[];
  unexpected: string[];
  duplicated: string[];
};

export type CsvParseResult =
  | { ok: true; members: MemberRow[]; rejected: RejectedRow[] }
  | CsvParseError;

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const isBlankRow = (row: string[]) =>
  row.every((field) => field.trim() === "");

const isInteger = (value: string) => /^-?\d+$/.test(value);

function fileError(
  error: string,
  missing: string[] = [],
  unexpected: string[] = [],
  duplicated: string[] = [],
): CsvParseError {
  return { ok: false, error, missing, unexpected, duplicated };
}

/**
 * Parse + validasi file export guild.
 *
 * - BOM UTF-8 di-strip, line ending CRLF/LF keduanya diterima.
 * - Header harus persis 12 kolom wajib -> kalau tidak, seluruh file ditolak.
 * - Baris bernomor/duplikat/non-numerik ditolak **per baris**, bukan menggagalkan file.
 * - Nama_player dianggap sama bila sama setelah trim + case-insensitive, supaya
 *   relink lineup by nama (D7) tidak ambigu.
 */
export function parseMemberCsv(text: string): CsvParseResult {
  const clean = text.replace(/^\uFEFF/, "");

  // Sisa byte yang tidak valid UTF-8 jadi U+FFFD -> nama member akan rusak
  // diam-diam. Tolak file-nya, suruh ekspor ulang sebagai UTF-8.
  if (clean.includes("\uFFFD")) {
    return fileError(
      "File bukan UTF-8 (kemungkinan encoding lain). Simpan ulang file sebagai UTF-8 lalu import lagi.",
    );
  }

  const parsed = Papa.parse<string[]>(clean, {
    delimiter: ",",
    skipEmptyLines: false,
  });

  // Kesalahan parse (mis. kutip yang tidak ditutup) ditolak per baris, bukan
  // menggagalkan seluruh file.
  const parseErrors = new Map<number, string>();
  for (const error of parsed.errors) {
    if (typeof error.row === "number") parseErrors.set(error.row, error.message);
  }

  const rows = parsed.data;
  if (rows.length === 0) return fileError("File CSV kosong.");

  const header = rows[0];
  const dataRows = rows
    .slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => !isBlankRow(row));

  if (dataRows.length > MAX_IMPORT_ROWS) {
    return fileError(
      `File terlalu banyak baris: ${dataRows.length} baris data (maksimal ${MAX_IMPORT_ROWS}).`,
    );
  }

  // --- validasi header -----------------------------------------------------
  const normalized = header.map(normalizeHeader);
  const requiredKeys = CSV_COLUMNS.map(normalizeHeader);
  const count = new Map<string, number>();
  for (const key of normalized) count.set(key, (count.get(key) ?? 0) + 1);

  const missing = CSV_COLUMNS.filter(
    (column) => !count.has(normalizeHeader(column)),
  );
  const unexpected = header
    .map((value, index) => ({ value: value.trim(), key: normalized[index] }))
    .filter(({ key }) => !requiredKeys.includes(key))
    .map(({ value }) => value);
  const duplicated = CSV_COLUMNS.filter(
    (column) => (count.get(normalizeHeader(column)) ?? 0) > 1,
  );

  if (missing.length || unexpected.length || duplicated.length) {
    const parts: string[] = [];
    if (missing.length) parts.push(`kolom wajib tidak ditemukan: ${missing.join(", ")}`);
    if (unexpected.length) parts.push(`kolom tidak dikenal: ${unexpected.join(", ")}`);
    if (duplicated.length) parts.push(`kolom muncul lebih dari sekali: ${duplicated.join(", ")}`);

    return fileError(
      `Header CSV tidak sesuai. ${parts.join(". ")}. Import ditolak utuh, tidak ada data yang berubah.`,
      missing,
      unexpected,
      duplicated,
    );
  }

  const columnIndex = new Map<string, number>();
  CSV_COLUMNS.forEach((column) => {
    const key = normalizeHeader(column);
    columnIndex.set(column, normalized.indexOf(key));
  });

  // --- validasi per baris --------------------------------------------------
  const members: MemberRow[] = [];
  const rejected: RejectedRow[] = [];
  const seenNames = new Set<string>();

  for (const { row, rowNumber } of dataRows) {
    const value = (column: string) => row[columnIndex.get(column)!].trim();

    const parseError = parseErrors.get(rowNumber - 1);
    if (parseError) {
      rejected.push({
        rowNumber,
        playerName: "",
        reason: `baris tidak bisa dibaca: ${parseError}`,
      });
      continue;
    }

    if (row.length !== CSV_COLUMNS.length) {
      rejected.push({
        rowNumber,
        playerName: "",
        reason: `jumlah kolom tidak sesuai: ${row.length} (harus ${CSV_COLUMNS.length})`,
      });
      continue;
    }

    const playerName = value("Player");
    if (!playerName) {
      rejected.push({ rowNumber, playerName: "", reason: "nama player kosong" });
      continue;
    }

    const numbers: Record<string, number> = {};
    let numericError: string | null = null;
    for (const column of NUMERIC_COLUMNS) {
      const raw = value(column);
      if (!isInteger(raw)) {
        numericError = `kolom "${column}" bukan angka: "${raw}"`;
        break;
      }
      numbers[column] = Number(raw);
    }
    if (numericError) {
      rejected.push({ rowNumber, playerName, reason: numericError });
      continue;
    }

    const nameKey = playerName.toLowerCase();
    if (seenNames.has(nameKey)) {
      rejected.push({ rowNumber, playerName, reason: "duplicate player name" });
      continue;
    }
    seenNames.add(nameKey);

    // `Id` cuma informasional (spec §4.2) -> kalau bukan angka, null; bukan alasan tolak baris.
    const rawId = value("Id");
    members.push({
      sourceId: isInteger(rawId) ? Number(rawId) : null,
      playerName,
      level: numbers["Lv."],
      className: value("Class"),
      title: value("Title"),
      gender: value("Gender"),
      guildRank: value("Position"),
      gearScore: numbers["Gear Score"],
      weekly: numbers["Weekly"],
      weeklyContribution: numbers["Weekly Contribution"],
      totalContribution: numbers["Total Contribution"],
      onlineStatus: value("Online Status"),
    });
  }

  return { ok: true, members, rejected };
}
