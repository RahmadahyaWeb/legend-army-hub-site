import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  groupByLane,
  getLineup,
  type LineupSlot,
  type LineupTeam,
} from "@/lib/lineup";

export const instant = false;

function SlotRow({ slot }: { slot: LineupSlot }) {
  const { slotNo, member } = slot;

  if (!member) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Slot {slotNo}
        </span>
        <Badge
          data-testid="empty-slot"
          variant="outline"
          aria-label={`Slot ${slotNo}, kosong`}
          className="ml-auto"
        >
          Kosong
        </Badge>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-border px-3 py-2"
      aria-label={`Slot ${slotNo}, ${member.player_name}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{member.player_name}</span>
        <Badge variant="secondary" className="shrink-0">
          GS {member.gear_score.toLocaleString("id-ID")}
        </Badge>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{member.class_name}</span>
        <span aria-hidden="true">·</span>
        <span>{member.guild_rank}</span>
      </div>
    </div>
  );
}

function TeamCard({ team }: { team: LineupTeam }) {
  return (
    <Card data-testid="team-card" size="sm" className="h-full">
      <CardHeader>
        <CardAction>
          <Badge variant="secondary">{team.lane.toUpperCase()}</Badge>
        </CardAction>
        <CardTitle>Tim {team.position}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2" role="list" aria-label={`Anggota Tim ${team.position}`}>
          {team.slots.map((slot) => (
            <div key={slot.slotNo} role="listitem" data-testid="lineup-slot">
              <SlotRow slot={slot} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function PublicLineupPage() {
  const groups = groupByLane(await getLineup());
  const totalTeams = groups.reduce((sum, group) => sum + group.teams.length, 0);

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Legend Army Hub
          </h1>
          <p className="text-muted-foreground">
            Susunan tim Guild League Legend Army.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {groups.map((group, index) => (
            <span key={group.lane} className="inline-flex items-center gap-3">
              <span className="font-medium text-foreground">
                {group.lane.toUpperCase()}
              </span>
              <span>{group.teams.length} tim</span>
              {index < groups.length - 1 && (
                <Separator orientation="vertical" className="h-4" />
              )}
            </span>
          ))}
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <span>Total {totalTeams} tim</span>
        </div>

        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.lane} data-testid="lane-group" aria-labelledby={`lane-heading-${group.lane}`}>
              <div className="mb-4 flex items-baseline gap-3">
                <h2
                  id={`lane-heading-${group.lane}`}
                  className="text-lg font-semibold tracking-tight"
                >
                  Jalur {group.lane.toUpperCase()}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {group.teams.length} tim
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.teams.map((team) => (
                  <TeamCard key={team.position} team={team} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
