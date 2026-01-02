import { useMemo } from "react";

import { useParticipants } from "@/hooks/use-participants";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useAssignments } from "@/hooks/use-assignments";
import { createEntityMap } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function AssignmentsStatCard() {
  const { participants } = useParticipants();
  const { restaurants } = useRestaurants();
  const { assignments } = useAssignments();

  const participantById = useMemo(
    () => createEntityMap(participants),
    [participants]
  );

  const totalCapacity = useMemo(
    () => restaurants.reduce((total, r) => total + r.max_seats, 0),
    [restaurants]
  );

  const nonCaptainCapacity = Math.max(totalCapacity - restaurants.length, 0);

  const assignedNonCaptains = useMemo(() => {
    return assignments.filter((assignment) => {
      const participant = participantById.get(assignment.participant_id);
      return (
        participant &&
        participant.status !== "cancelled" &&
        !participant.is_table_captain
      );
    }).length;
  }, [assignments, participantById]);

  const assignmentProgress =
    nonCaptainCapacity === 0
      ? 0
      : Math.min((assignedNonCaptains / nonCaptainCapacity) * 100, 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Assignments Progress
        </CardTitle>
        <CardDescription className="break-words">
          Participants placed into restaurants
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-semibold">{assignedNonCaptains}</span>
          <Badge variant="outline" className="break-words">
            {nonCaptainCapacity} capacity
          </Badge>
        </div>
        <Progress value={assignmentProgress} className="h-2" />
      </CardContent>
    </Card>
  );
}
