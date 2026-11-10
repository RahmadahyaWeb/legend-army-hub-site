"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { MAX_IMPORT_BYTES, parseMemberCsv, type RejectedRow } from "@/lib/csv";
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

type ImportRpcResult = {
  deleted: number;
  imported: number;
  relinked: number;
  dropped: { player_name: string; team_position: number; slot_no: number }[];
};

/** Baca file dari FormData + enforces batas ukuran sebelum isinya diparse. */
async function readCsvFile(
  formData: FormData,
): Promise<{ file: File; text: string } | ImportFailure> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", error: "Pilih file CSV export guild dulu." };
  }

  if (file.size > MAX_IMPORT_BYTES) {
    const size = (file.size / (1024 * 1024)).toFixed(1);
    return {
      status: "error",
      error: `File terlalu besar: ${size} MB (maksimal 5 MB).`,
    };
  }

  return { file, text: await file.text() };
}

/** Pratinjau: file dicek dulu, tanpa mengubah data apa pun. */
export async function previewImportAction(formData: FormData): Promise<ImportResult> {
  await requireAdmin();

  const read = await readCsvFile(formData);
  if ("status" in read) return read;

  const parsed = parseMemberCsv(read.text);
  if (!parsed.ok) return { status: "error", error: parsed.error };

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("guild_members")
    .select("id", { count: "exact", head: true });

  if (error) {
    return { status: "error", error: `Gagal membaca data member: ${error.message}` };
  }

  return {
    status: "preview",
    fileName: read.file.name,
    accepted: parsed.members.length,
    rejected: parsed.rejected,
    currentMembers: count ?? 0,
    sampleNames: parsed.members.slice(0, MAX_SAMPLE_NAMES).map((m) => m.playerName),
  };
}

/** Import: replace-all (semua member lama dihapus) + relink lineup by nama. */
export async function runImportAction(formData: FormData): Promise<ImportResult> {
  await requireAdmin();

  const read = await readCsvFile(formData);
  if ("status" in read) return read;

  const parsed = parseMemberCsv(read.text);
  if (!parsed.ok) return { status: "error", error: parsed.error };

  const payload = parsed.members.map((member) => ({
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

  // Data member berubah -> halaman lineup publik & area admin harus segar.
  revalidatePath("/");
  revalidatePath("/admin/members");

  const result = data as ImportRpcResult;

  return {
    status: "done",
    fileName: read.file.name,
    accepted: result.imported,
    rejected: parsed.rejected,
    deleted: result.deleted,
    relinked: result.relinked,
    dropped: result.dropped.map((slot) => ({
      playerName: slot.player_name,
      teamPosition: slot.team_position,
      slotNo: slot.slot_no,
    })),
    sampleNames: parsed.members.slice(0, MAX_SAMPLE_NAMES).map((m) => m.playerName),
  };
}
