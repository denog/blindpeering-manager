import { useMemo } from "react";

import { useParticipants } from "@/hooks/use-participants";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useAssignments } from "@/hooks/use-assignments";
import { useEventStatus } from "@/hooks/use-event-status";
import { createEntityMap } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const WORKFLOW_LABELS: Record<string, string> = {
  setup: "Setup",
  captains_assigned: "Captains Assigned",
  participants_assigned: "Participants Assigned",
  finalized: "Finalized",
};

export function StatusOverviewCard() {
  const { participants } = useParticipants();
  const { restaurants } = useRestaurants();
  const { assignments } = useAssignments();
  const { eventStatus } = useEventStatus();

  const participantById = useMemo(
    () => createEntityMap(participants),
    [participants]
  );

  const assignableParticipants = useMemo(
    () =>
      participants.filter(
        (p) => p.status === "registered" || p.status === "late_joiner"
      ),
    [participants]
  );

  const nonCaptainParticipants = useMemo(
    () => assignableParticipants.filter((p) => !p.is_table_captain),
    [assignableParticipants]
  );

  const restaurantsWithCaptain = useMemo(
    () => restaurants.filter((r) => Boolean(r.assigned_captain_id)),
    [restaurants]
  );

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

  const assignedParticipantsCount = useMemo(() => {
    return assignments.filter((assignment) => {
      const participant = participantById.get(assignment.participant_id);
      return participant && participant.status !== "cancelled";
    }).length;
  }, [assignments, participantById]);

  const participantsAwaitingAssignment = Math.max(
    nonCaptainParticipants.length - assignedNonCaptains,
    0
  );

  const workflowLabel = WORKFLOW_LABELS[eventStatus.state] ?? "Unknown";
  const lastUpdatedDisplay =
    eventStatus.updated_at && !eventStatus.updated_at.startsWith("1970-")
      ? new Date(eventStatus.updated_at).toLocaleString()
      : "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Overview</CardTitle>
        <CardDescription className="break-words">
          Track outstanding items before you finalize.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Last updated</span>
          <span className="text-sm font-medium text-foreground">
            {lastUpdatedDisplay}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Workflow state</span>
          <Badge>{workflowLabel}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Restaurants with captains
          </span>
          <span className="text-sm font-medium text-foreground">
            {restaurantsWithCaptain.length} / {restaurants.length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Participants awaiting placement
          </span>
          <span className="text-sm font-medium text-foreground">
            {participantsAwaitingAssignment}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Total assignments
          </span>
          <span className="text-sm font-medium text-foreground">
            {assignedParticipantsCount}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
