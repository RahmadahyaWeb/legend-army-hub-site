"use client";

import { useState, useTransition } from "react";
import {
  previewImportAction,
  runImportAction,
  type ImportResult,
} from "@/app/admin/members/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "radix-ui";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

function makeFormData(file: File): FormData {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [view, setView] = useState<"idle" | "preview" | "report">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      setResult(null);
      setView("idle");
    }
  };

  const handlePreview = () => {
    if (!file) return;
    startTransition(async () => {
      const res = await previewImportAction(makeFormData(file));
      setResult(res);
      setView(res.status === "preview" ? "preview" : "idle");
    });
  };

  const handleRunImport = () => {
    if (!file) return;
    startTransition(async () => {
      const res = await runImportAction(makeFormData(file));
      setResult(res);
      if (res.status === "done") {
        setView("report");
      }
    });
  };

  const handleCancel = () => {
    setView("idle");
    setResult(null);
    setFile(null);
  };

  const handleReset = () => {
    setView("idle");
    setResult(null);
    setFile(null);
  };

  const preview = result?.status === "preview" ? result : null;
  const report = result?.status === "done" ? result : null;
  const error = result?.status === "error" ? result.error : null;

  return (
    <div className="space-y-4">
      {view === "idle" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">File CSV</Label>
            <Input
              id="csv-file"
              data-testid="import-file"
              type="file"
              accept=".csv"
              disabled={isPending}
              onChange={handleFileChange}
            />
            {file ? (
              <p className="text-xs text-muted-foreground">{file.name}</p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              data-testid="import-error"
              className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            data-testid="import-preview-button"
            disabled={!file || isPending}
            onClick={handlePreview}
          >
            {isPending ? "Memeriksa…" : "Periksa"}
          </Button>
        </div>
      )}

      {view === "preview" && preview && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open && view === "preview") {
              handleCancel();
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
            <Dialog.Content
              data-testid="import-preview"
              aria-live="polite"
              className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl bg-card p-6 shadow-lg ring-1 ring-border"
            >
              <div className="space-y-1">
                <Dialog.Title className="text-lg font-semibold tracking-tight">
                  Pratinjau Import
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  Periksa hasil pemindaian file sebelum mengganti data member.
                </Dialog.Description>
              </div>

              {error ? (
                <p
                  role="alert"
                  data-testid="import-error"
                  className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
                >
                  {error}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Diterima</p>
                  <p
                    data-testid="import-accepted"
                    className="text-2xl font-semibold"
                  >
                    {preview.accepted}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Ditolak</p>
                  <p
                    data-testid="import-rejected"
                    className="text-2xl font-semibold"
                  >
                    {preview.rejected.length}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Member saat ini
                  </p>
                  <p className="text-2xl font-semibold">
                    {preview.currentMembers}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">File</p>
                  <p className="truncate text-sm font-medium">{preview.fileName}</p>
                </div>
              </div>

              {preview.rejected.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Baris ditolak</p>
                  <div
                    data-testid="import-rejected-list"
                    className="max-h-40 overflow-y-auto rounded-lg border text-sm"
                  >
                    {preview.rejected.map((row) => (
                      <div
                        key={row.rowNumber}
                        className="flex items-start gap-3 border-b px-3 py-2 last:border-b-0"
                      >
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Baris {row.rowNumber}
                        </span>
                        <span className="flex-1">{row.reason}</span>
                        {row.playerName ? (
                          <span className="shrink-0 text-muted-foreground">
                            {row.playerName}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.sampleNames.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Contoh nama yang masuk</p>
                  <div
                    data-testid="import-preview-names"
                    className="flex flex-wrap gap-1.5"
                  >
                    {preview.sampleNames.map((name) => (
                      <Badge key={name} variant="secondary">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    Import akan menghapus{" "}
                    <span data-testid="import-delete-count">
                      {preview.currentMembers}
                    </span>{" "}
                    member yang ada sekarang dan menggantinya dengan{" "}
                    {preview.accepted} member dari file.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={handleCancel}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  data-testid="import-confirm-button"
                  disabled={isPending}
                  onClick={handleRunImport}
                >
                  {isPending ? "Mengimport…" : "Ya, import sekarang"}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {view === "report" && report && (
        <div
          data-testid="import-report"
          aria-live="polite"
          className="space-y-5"
        >
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <CheckCircle2 className="size-5 text-green-600" />
            <div>
              <p className="font-medium">Import selesai</p>
              <p className="text-sm text-muted-foreground">{report.fileName}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Diterima</p>
              <p
                data-testid="import-accepted"
                className="text-2xl font-semibold"
              >
                {report.accepted}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Ditolak</p>
              <p
                data-testid="import-rejected"
                className="text-2xl font-semibold"
              >
                {report.rejected.length}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Dihapus</p>
              <p className="text-2xl font-semibold">{report.deleted}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Slot tetap terisi</p>
              <p className="text-2xl font-semibold">{report.relinked}</p>
            </div>
          </div>

          {report.rejected.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Baris ditolak</p>
              <div
                data-testid="import-rejected-list"
                className="max-h-40 overflow-y-auto rounded-lg border text-sm"
              >
                {report.rejected.map((row) => (
                  <div
                    key={row.rowNumber}
                    className="flex items-start gap-3 border-b px-3 py-2 last:border-b-0"
                  >
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Baris {row.rowNumber}
                    </span>
                    <span className="flex-1">{row.reason}</span>
                    {row.playerName ? (
                      <span className="shrink-0 text-muted-foreground">
                        {row.playerName}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Member yang kehilangan slot</p>
            <div
              data-testid="import-dropped-list"
              className="rounded-lg border text-sm"
            >
              {report.dropped.length === 0 ? (
                <p className="px-3 py-2 text-muted-foreground">
                  Tidak ada member yang kehilangan slot lineup.
                </p>
              ) : (
                report.dropped.map((slot) => (
                  <div
                    key={`${slot.teamPosition}-${slot.slotNo}`}
                    className="border-b px-3 py-2 last:border-b-0"
                  >
                    {slot.playerName} — Tim {slot.teamPosition}, slot{" "}
                    {slot.slotNo}
                  </div>
                ))
              )}
            </div>
          </div>

          {report.sampleNames.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Contoh nama yang masuk</p>
              <div
                data-testid="import-preview-names"
                className="flex flex-wrap gap-1.5"
              >
                {report.sampleNames.map((name) => (
                  <Badge key={name} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button type="button" onClick={handleReset}>
            Import file lain
          </Button>
        </div>
      )}
    </div>
  );
}
