import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shuffle, Users, Mail, Lock, UserPlus } from "lucide-react";

import { useParticipants } from "@/hooks/use-participants";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useAssignments } from "@/hooks/use-assignments";
import { useEventStatus } from "@/hooks/use-event-status";
import { useToast } from "@/hooks/use-toast";
import { useEmails } from "@/hooks/use-emails";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import {
  buildRestaurantRosters,
  planCaptainAssignments,
  planParticipantAssignments,
} from "@/lib/assignment-utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ShuffleWarningDialog } from "@/components/shuffle-warning-dialog";

export function QuickActionsCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { participants } = useParticipants();
  const { restaurants } = useRestaurants();
  const { assignments, clearAssignmentsMutation } = useAssignments();
  const { eventStatus, setEventStatusMutation } = useEventStatus();
  const { sendBulkEmailsMutation, sendCaptainOverviewsMutation, emailLogs } =
    useEmails();

  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [isAssigningCaptains, setIsAssigningCaptains] = useState(false);
  const [isAssigningParticipants, setIsAssigningParticipants] = useState(false);
  const [isAssigningUnassigned, setIsAssigningUnassigned] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [pendingEmailType, setPendingEmailType] = useState<
    "initial_assignment" | "final_assignment" | null
  >(null);
  const [isSendingCaptainOverviews, setIsSendingCaptainOverviews] =
    useState(false);

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

  const activeCaptains = useMemo(
    () =>
      participants.filter(
        (p) => p.is_table_captain && p.status !== "cancelled"
      ),
    [participants]
  );

  const restaurantsWithCaptain = useMemo(
    () => restaurants.filter((r) => Boolean(r.assigned_captain_id)),
    [restaurants]
  );

  const hasSentInvitationEmails = useMemo(
    () => emailLogs.some((log) => log.email_type === "initial_assignment"),
    [emailLogs]
  );

  const captainShortfall = activeCaptains.length < restaurants.length;
  const isFinalized = eventStatus.state === "finalized";

  const handleAssignCaptains = async () => {
    if (isAssigningCaptains) return;
    if (hasSentInvitationEmails) {
      toast({
        title: "Invitations sent",
        description: "Captains cannot be reassigned after invitations are sent.",
      });
      return;
    }
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description: "Captains cannot be reassigned after finalization.",
      });
      return;
    }
    if (!restaurants.length) {
      toast({
        title: "No restaurants available",
        description: "Add restaurants before assigning captains.",
        variant: "destructive",
      });
      return;
    }
    if (activeCaptains.length < restaurants.length) {
      toast({
        title: "Not enough captains",
        description: `You need ${restaurants.length} captains but only have ${activeCaptains.length}.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAssigningCaptains(true);
      const plan = planCaptainAssignments(restaurants, activeCaptains);

      for (const { restaurantId, captainId } of plan) {
        await api.patch(`/restaurants/${restaurantId}/`, {
          assigned_captain_id: captainId,
        });
      }

      await setEventStatusMutation.mutateAsync("captains_assigned");

      await queryClient.invalidateQueries({
        queryKey: queryKeys.restaurants.all,
      });
      toast({
        title: "Captains assigned",
        description: "Each restaurant now has a table captain.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Failed to assign captains",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAssigningCaptains(false);
    }
  };

  const executeParticipantAssignment = async () => {
    if (isAssigningParticipants) return;
    if (!restaurantsWithCaptain.length) {
      toast({
        title: "Assign captains first",
        description:
          "Participants can only be placed once all restaurants have captains.",
        variant: "destructive",
      });
      return;
    }
    if (!nonCaptainParticipants.length) {
      toast({
        title: "No participants to assign",
        description: "Import or mark attendees as registered before assigning.",
      });
      return;
    }

    try {
      setIsAssigningParticipants(true);
      const { assignments: plannedAssignments, unassigned } =
        planParticipantAssignments(restaurants, assignableParticipants);

      if (assignments.length > 0) {
        await clearAssignmentsMutation.mutateAsync();
      }

      if (plannedAssignments.length) {
        const payload = plannedAssignments.map(
          ({ participantId, restaurantId }) => ({
            participant: participantId,
            restaurant: restaurantId,
          })
        );
        await api.post("/assignments/bulk_create/", payload);
      }

      await setEventStatusMutation.mutateAsync("participants_assigned");

      await queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.all,
      });
      toast({
        title: "Participants assigned",
        description:
          plannedAssignments.length === 0
            ? "No participants could be assigned."
            : unassigned.length
            ? `${plannedAssignments.length} assigned. ${unassigned.length} could not be placed due to capacity.`
            : "All eligible participants have been assigned.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Assignment failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAssigningParticipants(false);
      setShowReassignDialog(false);
    }
  };

  const handleAssignParticipants = () => {
    if (hasSentInvitationEmails) {
      toast({
        title: "Invitations sent",
        description:
          "Participants cannot be completely reshuffled after invitations are sent.",
      });
      return;
    }
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description:
          "Assignments are locked. Unfinalize the event to reshuffle.",
      });
      return;
    }
    if (assignments.length > 0) {
      setShowReassignDialog(true);
    } else {
      void executeParticipantAssignment();
    }
  };

  const handleAssignUnassigned = async () => {
    if (isAssigningUnassigned) return;
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description:
          "Assignments are locked. Unfinalize the event to reshuffle.",
      });
      return;
    }
    if (!restaurantsWithCaptain.length) {
      toast({
        title: "Assign captains first",
        description:
          "Participants can only be placed once all restaurants have captains.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAssigningUnassigned(true);

      const assignedParticipantIds = new Set(
        assignments.map((a) => a.participant_id)
      );

      const unassignedParticipants = assignableParticipants.filter(
        (p) => !assignedParticipantIds.has(p.id) && !p.is_table_captain
      );

      if (unassignedParticipants.length === 0) {
        toast({
          title: "No unassigned participants",
          description: "All eligible participants are already assigned.",
        });
        return;
      }

      const existingAssignmentCounts = new Map<string, number>();
      for (const assignment of assignments) {
        const count =
          existingAssignmentCounts.get(assignment.restaurant_id) ?? 0;
        existingAssignmentCounts.set(assignment.restaurant_id, count + 1);
      }

      const { assignments: plannedAssignments, unassigned } =
        planParticipantAssignments(restaurants, unassignedParticipants, {
          existingAssignmentCounts,
        });

      if (plannedAssignments.length) {
        const payload = plannedAssignments.map(
          ({ participantId, restaurantId }) => ({
            participant: participantId,
            restaurant: restaurantId,
          })
        );
        await api.post("/assignments/bulk_create/", payload);
      }

      await setEventStatusMutation.mutateAsync("participants_assigned");

      await queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.all,
      });
      toast({
        title: "Unassigned participants placed",
        description:
          plannedAssignments.length === 0
            ? "No participants could be assigned."
            : unassigned.length
            ? `${plannedAssignments.length} assigned. ${unassigned.length} could not be placed due to capacity.`
            : `All ${plannedAssignments.length} unassigned participants have been placed.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Assignment failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAssigningUnassigned(false);
    }
  };

  const handleSendBulkEmails = async (
    emailType: "initial_assignment" | "final_assignment"
  ) => {
    if (sendBulkEmailsMutation.isPending) return;

    if (!assignments.length) {
      toast({
        title: "No assignments yet",
        description: "Assign participants before sending emails.",
        variant: "destructive",
      });
      return;
    }

    const rosters = buildRestaurantRosters(
      restaurants,
      participants,
      assignments.map((assignment) => ({
        participantId: assignment.participant_id,
        restaurantId: assignment.restaurant_id,
      }))
    );

    const emails = rosters.flatMap((roster) => {
      const tableGuests = roster.participants;
      const allParticipants = [...tableGuests, roster.captain].filter(
        (p): p is (typeof participants)[0] => Boolean(p)
      );

      return allParticipants.map((participant) => ({
        participant,
        restaurant: roster.restaurant,
        captain: roster.captain,
        tableGuests: tableGuests.filter((p) => p.id !== participant.id),
        emailType,
      }));
    });

    if (emails.length === 0) {
      toast({
        title: "No recipients found",
        description: "Ensure participants are assigned before sending emails.",
        variant: "destructive",
      });
      return;
    }

    try {
      setPendingEmailType(emailType);
      const result = await sendBulkEmailsMutation.mutateAsync({
        emails,
        emailType,
      });

      if (result.failed_count > 0 && result.sent_count > 0) {
        toast({
          title: "Some emails sent",
          description: `Sent ${result.sent_count} emails. ${result.failed_count} failed.`,
          variant: "destructive",
        });
      } else if (result.sent_count > 0) {
        toast({
          title: "Emails sent",
          description: `Successfully sent ${result.sent_count} assignment emails.`,
        });
      } else {
        toast({
          title: "No emails sent",
          description: "All emails failed to send. Check event settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Email send error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Failed to send emails",
        description: errorMessage,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setPendingEmailType(null);
    }
  };

  const handleSendCaptainOverviews = async () => {
    if (isSendingCaptainOverviews) return;

    const restaurantsWithCaptains = restaurants.filter(
      (r) => r.assigned_captain_id
    );

    if (restaurantsWithCaptains.length === 0) {
      toast({
        title: "No captains assigned",
        description: "Assign captains to restaurants before sending overviews.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSendingCaptainOverviews(true);
      const result = await sendCaptainOverviewsMutation.mutateAsync();

      if (result.failed_count > 0 && result.sent_count > 0) {
        toast({
          title: "Some emails sent",
          description: `Sent ${result.sent_count} emails. ${result.failed_count} failed.`,
          variant: "destructive",
        });
      } else if (result.sent_count > 0) {
        toast({
          title: "Captain overviews sent",
          description: `Successfully sent ${result.sent_count} overview emails to captains.`,
        });
      } else {
        toast({
          title: "No emails sent",
          description: "All emails failed to send.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Captain overview email error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Failed to send captain overviews",
        description: errorMessage,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsSendingCaptainOverviews(false);
    }
  };

  const handleFinalize = async () => {
    if (isFinalizing) return;
    if (isFinalized) {
      toast({
        title: "Already finalized",
        description: "The event is already locked.",
      });
      return;
    }
    if (assignments.length === 0) {
      toast({
        title: "Assign participants first",
        description: "Finalize after participants have been placed.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsFinalizing(true);
      await setEventStatusMutation.mutateAsync("finalized");
      toast({
        title: "Event finalized",
        description: "Assignments are now locked.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to finalize",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription className="break-words">
            Run assignments or notify attendees.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 bg-transparent"
            onClick={handleAssignCaptains}
            disabled={
              isAssigningCaptains ||
              captainShortfall ||
              isFinalized ||
              hasSentInvitationEmails
            }
            title={
              hasSentInvitationEmails
                ? "Invitations have been sent. Re-assigning is disabled."
                : captainShortfall
                ? "You need at least as many captains as restaurants."
                : isFinalized
                ? "Assignments are locked."
                : undefined
            }
          >
            {isAssigningCaptains ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Assign all captains
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 bg-transparent"
            onClick={handleAssignParticipants}
            disabled={
              isAssigningParticipants ||
              isFinalized ||
              captainShortfall ||
              hasSentInvitationEmails
            }
            title={
              hasSentInvitationEmails
                ? "Invitations have been sent. Mass reshuffling is disabled."
                : captainShortfall
                ? "Assign captains before shuffling participants."
                : isFinalized
                ? "Assignments are locked."
                : undefined
            }
          >
            {isAssigningParticipants ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Shuffle className="h-4 w-4" />
            )}
            Assign all participants
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 bg-transparent"
            onClick={handleAssignUnassigned}
            disabled={isAssigningUnassigned || isFinalized || captainShortfall}
            title={
              captainShortfall
                ? "Assign captains before placing participants."
                : isFinalized
                ? "Assignments are locked."
                : undefined
            }
          >
            {isAssigningUnassigned ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Assign unassigned
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 bg-transparent"
            onClick={() => handleSendBulkEmails("initial_assignment")}
            disabled={sendBulkEmailsMutation.isPending || !assignments.length}
            title={
              !assignments.length
                ? "Assign participants before sending emails."
                : undefined
            }
          >
            {sendBulkEmailsMutation.isPending &&
            pendingEmailType === "initial_assignment" ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Send Invitation Emails
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 bg-transparent"
            onClick={handleSendCaptainOverviews}
            disabled={
              isSendingCaptainOverviews || !restaurantsWithCaptain.length
            }
            title={
              !restaurantsWithCaptain.length
                ? "Assign captains before sending overviews."
                : undefined
            }
          >
            {isSendingCaptainOverviews ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Send Participant overview to captains
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 bg-transparent"
            onClick={handleFinalize}
            disabled={isFinalizing || isFinalized}
          >
            {isFinalizing ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Finalize event
          </Button>
        </CardContent>
      </Card>

      <ShuffleWarningDialog
        open={showReassignDialog}
        onOpenChange={setShowReassignDialog}
        onConfirm={executeParticipantAssignment}
      />
    </>
  );
}
