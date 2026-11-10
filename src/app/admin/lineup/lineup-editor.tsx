"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { assignMemberAction, unassignMemberAction } from "@/app/admin/lineup/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LineupTeam, PoolMember } from "@/lib/lineup";

const slotId = (teamPosition: number, slotNo: number) => `${teamPosition}:${slotNo}`;

function parseSlotId(id: string): { teamPosition: number; slotNo: number } | null {
  const [teamPosition, slotNo] = id.split(":").map(Number);
  if (!Number.isInteger(teamPosition) || !Number.isInteger(slotNo)) return null;
  return { teamPosition, slotNo };
}

function PoolMemberItem({
  member,
  selected,
  onSelect,
}: {
  member: PoolMember;
  selected: boolean;
  onSelect: (memberId: string) => void;
}) {
  const assigned = member.teamPosition !== null;
  const { setNodeRef, listeners } = useDraggable({ id: member.id, disabled: assigned });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      data-testid="pool-member"
      data-member-id={member.id}
      data-assigned={assigned || undefined}
      className="rounded-lg"
    >
      <button
        type="button"
        disabled={assigned}
        aria-pressed={selected}
        onClick={() => onSelect(member.id)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{member.player_name}</span>
          <span className="block text-xs text-muted-foreground">
            {member.class_name}
          </span>
        </span>
        {assigned ? (
          <Badge variant="secondary" className="shrink-0">
            Tim {member.teamPosition}
          </Badge>
        ) : null}
      </button>
    </div>
  );
}

function Slot({
  teamPosition,
  slot,
  selectedMemberId,
  isPending,
  onAssign,
  onRemove,
}: {
  teamPosition: number;
  slot: LineupTeam["slots"][number];
  selectedMemberId: string | null;
  isPending: boolean;
  onAssign: (teamPosition: number, slotNo: number) => void;
  onRemove: (memberId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotId(teamPosition, slot.slotNo),
  });

  const { slotNo, member } = slot;

  if (member) {
    return (
      <div
        ref={setNodeRef}
        data-testid={`slot-${teamPosition}-${slotNo}`}
        data-filled="true"
        className="rounded-lg border border-border px-3 py-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{member.player_name}</span>
          <Badge variant="secondary" className="shrink-0">
            GS {member.gear_score.toLocaleString("id-ID")}
          </Badge>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {member.class_name} · {member.guild_rank}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onRemove(member.id)}
          >
            Keluarkan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      data-testid={`slot-${teamPosition}-${slotNo}`}
      data-filled="false"
      className={`rounded-lg border border-dashed px-3 py-2 transition-colors ${
        isOver ? "border-primary bg-primary/10" : "border-border"
      }`}
    >
      <button
        type="button"
        data-testid={`empty-slot-${teamPosition}-${slotNo}`}
        disabled={isPending || !selectedMemberId}
        onClick={() => onAssign(teamPosition, slotNo)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="text-xs font-medium text-muted-foreground">Slot {slotNo}</span>
        <Badge variant="outline">Kosong</Badge>
      </button>
    </div>
  );
}

export function LineupEditor({ teams, pool }: { teams: LineupTeam[]; pool: PoolMember[] }) {
  const router = useRouter();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const selectedMember = pool.find((member) => member.id === selectedMemberId) ?? null;

  function run(action: () => Promise<{ status: "ok" } | { status: "error"; error: string }>) {
    setSelectedMemberId(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        setMessage({ kind: "error", text: result.error });
      }
      // State selalu diambil ulang dari server: tidak ada optimistic update,
      // jadi UI tidak pernah menampilkan keadaan yang keliru.
      router.refresh();
    });
  }

  function assign(memberId: string, teamPosition: number, slotNo: number) {
    run(() => assignMemberAction(memberId, teamPosition, slotNo));
  }

  function unassign(memberId: string) {
    run(() => unassignMemberAction(memberId));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const slot = parseSlotId(String(over.id));
    if (!slot) return;

    assign(String(active.id), slot.teamPosition, slot.slotNo);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <aside className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Pool Member</h2>
            <span className="text-xs text-muted-foreground">{pool.length} member</span>
          </div>
          <p
            data-testid="lineup-selection"
            aria-live="polite"
            className="text-xs text-muted-foreground"
          >
            {selectedMember
              ? `Memilih ${selectedMember.player_name} — klik slot kosong.`
              : "Klik member, lalu klik slot kosong. Atau seret member ke slot."}
          </p>
          <div
            data-testid="pool-list"
            className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto rounded-lg border p-2"
          >
            {pool.map((member) => (
              <PoolMemberItem
                key={member.id}
                member={member}
                selected={member.id === selectedMemberId}
                onSelect={(id) =>
                  setSelectedMemberId((current) => (current === id ? null : id))
                }
              />
            ))}
          </div>
        </aside>

        <div className="space-y-3">
          {message ? (
            <p
              role="alert"
              data-testid="lineup-error"
              className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
            >
              {message.text}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => (
              <Card key={team.position} data-testid="editor-team-card" size="sm" className="h-full">
                <CardHeader>
                  <CardTitle>Tim {team.position}</CardTitle>
                  <Badge variant="secondary">{team.lane.toUpperCase()}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {team.slots.map((slot) => (
                      <Slot
                        key={slot.slotNo}
                        teamPosition={team.position}
                        slot={slot}
                        selectedMemberId={selectedMemberId}
                        isPending={isPending}
                        onAssign={(teamPosition, slotNo) => {
                          if (selectedMemberId) {
                            assign(selectedMemberId, teamPosition, slotNo);
                          }
                        }}
                        onRemove={unassign}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
