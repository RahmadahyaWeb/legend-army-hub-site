"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  MAX_IMPORT_BYTES,
  parseMemberCsv,
  type MemberRow,
  type RejectedRow,
} from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

// Import CSV member (spec .scratch/guild-league-lineup/spec.md §4.3, US-1).
//
// Semua file dibaca & divalidasi ulang di server; client tidak pernah boleh
// trusted. Batas 5 MB / 2000 baris ditegakkan di sini, bukan hanya di UI.

/** Berapa nama member yang ditampilkan di pratinjau laporan. */
const MAX_SAMPLE_NAMES = 10;

export type ImportPreview = {
  status: "preview";
  fileName: string;
  /** Jumlah baris yang akan diterima. */
  accepted: number;
  rejected: RejectedRow[];
  /** Jumlah member yang ada sekarang (= yang akan dihapus, import bersifat replace-all). */
  currentMembers: number;
  sampleNames: string[];
};

export type ImportReport = {
  status: "done";
  fileName: string;
  accepted: number;
  rejected: RejectedRow[];
  /** Member yang dihapus oleh import ini. */
  deleted: number;
  /** Slot lineup yang tetap terisi (member dicocokkan by nama). */
  relinked: number;
  /** Member yang kehilangan slot lineup karena tidak ada di CSV. */
  dropped: { playerName: string; teamPosition: number; slotNo: number }[];
  sampleNames: string[];
};

export type ImportFailure = { status: "error"; error: string };

export type ImportResult = ImportPreview | ImportReport | ImportFailure;

// Tipe baris yang ditolak juga dipakai komponen UI.
export type { RejectedRow } from "@/lib/csv";

type ImportRpcResult = {
  deleted: number;
  imported: number;
  relinked: number;
  dropped: { player_name: string; team_position: number; slot_no: number }[];
};

type PreparedImport = {
  file: File;
  members: MemberRow[];
  rejected: RejectedRow[];
};

/** Bentuk jsonb dari fungsi Postgres, dicek sebelum dipakai (trust boundary). */
function isImportRpcResult(data: unknown): data is ImportRpcResult {
  if (typeof data !== "object" || data === null) return false;
  const result = data as Record<string, unknown>;

  return (
    typeof result.deleted === "number" &&
    typeof result.imported === "number" &&
    typeof result.relinked === "number" &&
    Array.isArray(result.dropped)
  );
}

const formatMb = (bytes: number) =>
  (bytes / (1024 * 1024)).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

/** Baca file dari FormData + enforces batas ukuran sebelum isinya diparse. */
async function readCsvFile(
  formData: FormData,
): Promise<{ file: File; text: string } | ImportFailure> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", error: "Pilih file CSV export guild dulu." };
  }

  if (file.size > MAX_IMPORT_BYTES) {
    return {
      status: "error",
      error: `File terlalu besar: ${formatMb(file.size)} MB (maksimal 5 MB).`,
    };
  }

  return { file, text: await file.text() };
}

/** Gate admin + validasi file. Dipakai kedua action supaya aturannya sama. */
async function prepareImport(formData: FormData): Promise<PreparedImport | ImportFailure> {
  await requireAdmin();

  const read = await readCsvFile(formData);
  if ("status" in read) return read;

  const parsed = parseMemberCsv(read.text);
  if (!parsed.ok) return { status: "error", error: parsed.error };

  return { file: read.file, members: parsed.members, rejected: parsed.rejected };
}

/** Pratinjau: file dicek dulu, tanpa mengubah data apa pun. */
export async function previewImportAction(formData: FormData): Promise<ImportResult> {
  const prepared = await prepareImport(formData);
  if ("status" in prepared) return prepared;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("guild_members")
    .select("id", { count: "exact", head: true });

  if (error) {
    return { status: "error", error: `Gagal membaca data member: ${error.message}` };
  }

  return {
    status: "preview",
    fileName: prepared.file.name,
    accepted: prepared.members.length,
    rejected: prepared.rejected,
    currentMembers: count ?? 0,
    sampleNames: prepared.members.slice(0, MAX_SAMPLE_NAMES).map((m) => m.playerName),
  };
}

/** Import: replace-all (semua member lama dihapus) + relink lineup by nama. */
export async function runImportAction(formData: FormData): Promise<ImportResult> {
  const prepared = await prepareImport(formData);
  if ("status" in prepared) return prepared;

  const payload = prepared.members.map((member) => ({
    source_id: member.sourceId,
    player_name: member.playerName,
    level: member.level,
    class_name: member.className,
    title: member.title,
    gender: member.gender,
    guild_rank: member.guildRank,
    gear_score: member.gearScore,
    weekly: member.weekly,
    weekly_contribution: member.weeklyContribution,
    total_contribution: member.totalContribution,
    online_status: member.onlineStatus,
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_members", { payload });

  if (error) {
    return { status: "error", error: `Import gagal: ${error.message}` };
  }

  if (!isImportRpcResult(data)) {
    return { status: "error", error: "Import gagal: format hasil database tidak dikenali." };
  }

  // Data member berubah -> halaman lineup publik & area admin harus segar.
  // Editor lineup ikut karena nama/slot di sana berasal dari tabel member.
  revalidatePath("/");
  revalidatePath("/admin/members");
  revalidatePath("/admin/lineup");

  return {
    status: "done",
    fileName: prepared.file.name,
    accepted: data.imported,
    rejected: prepared.rejected,
    deleted: data.deleted,
    relinked: data.relinked,
    dropped: data.dropped.map((slot) => ({
      playerName: slot.player_name,
      teamPosition: slot.team_position,
      slotNo: slot.slot_no,
    })),
    sampleNames: prepared.members.slice(0, MAX_SAMPLE_NAMES).map((m) => m.playerName),
  };
}
