import { useMemo } from "react";

import { useParticipants } from "@/hooks/use-participants";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useAssignments } from "@/hooks/use-assignments";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ParticipantsStatCard() {
  const { participants } = useParticipants();
  const { restaurants } = useRestaurants();
  const { assignments } = useAssignments();

  const assignableParticipants = useMemo(
    () =>
      participants.filter(
        (p) => p.status === "registered" || p.status === "late_joiner"
      ),
    [participants]
  );

  const unassignedCount = useMemo(() => {
    const assignedParticipantIds = new Set(
      assignments.map((a) => a.participant_id)
    );
    const captainIds = new Set(
      restaurants.map((r) => r.assigned_captain_id).filter(Boolean)
    );
    return assignableParticipants.filter(
      (p) => !assignedParticipantIds.has(p.id) && !captainIds.has(p.id)
    ).length;
  }, [assignableParticipants, assignments, restaurants]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Participants</CardTitle>
        <CardDescription className="break-words">
          Total imported from Pretix
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-semibold">{participants.length}</span>
          <Badge variant="outline" className="break-words">
            {unassignedCount} unassigned
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
