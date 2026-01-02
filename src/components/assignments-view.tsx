import {
  AlertTriangle,
  Download,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssignments } from "@/hooks/use-assignments";
import { useEmails } from "@/hooks/use-emails";
import { useEventStatus } from "@/hooks/use-event-status";
import { useParticipants } from "@/hooks/use-participants";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useToast } from "@/hooks/use-toast";
import { useFirstEmailByParticipant } from "@/hooks/use-first-email-by-participant";
import {
  buildRestaurantRosters,
  buildRosterPrintHtml,
  generateAssignmentCsv,
} from "@/lib/assignment-utils";
import { getDuplicateEmails, createEntityMap } from "@/lib/utils";
import { SearchInput } from "@/components/search-input";
import { AssignmentsPeopleList } from "@/components/assignments/assignments-people-list";
import { AssignmentsRestaurantList } from "@/components/assignments/assignments-restaurant-list";

export function AssignmentsView() {
  const {
    assignments,
    isLoading: assignmentsLoading,
    assignMutation,
    unassignMutation,
  } = useAssignments();
  const { participants, isLoading: participantsLoading } = useParticipants();
  const { restaurants, isLoading: restaurantsLoading } = useRestaurants();
  const { toast } = useToast();
  const { eventStatus, setEventStatusMutation } = useEventStatus();
  const { emailLogs, sendEmailMutation } = useEmails();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"people" | "restaurants">(
    "people"
  );
  const [pendingAdd, setPendingAdd] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Debounce search to avoid excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const participantById = useMemo(
    () => createEntityMap(participants),
    [participants]
  );

  const firstEmailByParticipant = useFirstEmailByParticipant(emailLogs);

  const eligibleParticipants = useMemo(
    () =>
      participants.filter((participant) => participant.status !== "cancelled"),
    [participants]
  );

  // Detect duplicate emails
  const duplicateEmails = useMemo(
    () => getDuplicateEmails(participants, (p) => p.attendee_email),
    [participants]
  );

  const nonCaptainParticipants = useMemo(
    () =>
      eligibleParticipants.filter(
        (participant) => !participant.is_table_captain
      ),
    [eligibleParticipants]
  );

  const excludedDuplicates = useMemo(
    () =>
      eligibleParticipants.filter(
        (participant) =>
          !participant.is_table_captain &&
          duplicateEmails.has(participant.attendee_email.toLowerCase())
      ),
    [eligibleParticipants, duplicateEmails]
  );

  const assignmentsByParticipant = useMemo(() => {
    const result: Record<string, string> = {};

    // Add regular assignments from the assignments table
    assignments.forEach((assignment) => {
      result[assignment.participant_id] = assignment.restaurant_id;
    });

    // Add captain assignments from restaurants table
    restaurants.forEach((restaurant) => {
      if (restaurant.assigned_captain_id) {
        result[restaurant.assigned_captain_id] = restaurant.id;
      }
    });

    return result;
  }, [assignments, restaurants]);

  const assignmentsByRestaurant = useMemo(() => {
    return assignments.reduce<Record<string, string[]>>((acc, assignment) => {
      if (!acc[assignment.restaurant_id]) {
        acc[assignment.restaurant_id] = [];
      }
      acc[assignment.restaurant_id].push(assignment.participant_id);
      return acc;
    }, {});
  }, [assignments]);

  const unassignedParticipants = useMemo(
    () =>
      nonCaptainParticipants.filter(
        (participant) => !assignmentsByParticipant[participant.id]
      ),
    [nonCaptainParticipants, assignmentsByParticipant]
  );

  const filteredPeople = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) {
      return eligibleParticipants;
    }
    return eligibleParticipants.filter((participant) => {
      const assignmentRestaurantId = assignmentsByParticipant[participant.id];
      const restaurantName = assignmentRestaurantId
        ? restaurants.find(
            (restaurant) => restaurant.id === assignmentRestaurantId
          )?.name ?? ""
        : "";
      return (
        participant.attendee_name.toLowerCase().includes(term) ||
        participant.attendee_email.toLowerCase().includes(term) ||
        participant.pretix_id?.toString().includes(term) ||
        restaurantName.toLowerCase().includes(term)
      );
    });
  }, [
    eligibleParticipants,
    debouncedSearch,
    assignmentsByParticipant,
    restaurants,
  ]);

  const filteredRestaurants = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) {
      return restaurants;
    }
    return restaurants.filter(
      (restaurant) =>
        restaurant.name.toLowerCase().includes(term) ||
        restaurant.address.toLowerCase().includes(term)
    );
  }, [restaurants, debouncedSearch]);

  // Paginated people for display
  const paginatedPeople = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPeople.slice(startIndex, endIndex);
  }, [filteredPeople, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPeople.length / itemsPerPage);

  // Reset page when debounced search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const isBusy =
    assignMutation.isPending ||
    unassignMutation.isPending ||
    setEventStatusMutation.isPending;

  const isFinalized = eventStatus.state === "finalized";

  const handleManualAssign = async (
    participantId: string,
    restaurantId: string | null
  ) => {
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description:
          "Assignments are locked. Unfinalize the event to make changes.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!restaurantId) {
        await unassignMutation.mutateAsync(participantId);
        toast({
          title: "Participant unassigned",
          description: "This person has been removed from their table.",
        });
      } else {
        await assignMutation.mutateAsync({
          participant_id: participantId,
          restaurant_id: restaurantId,
        });
        if (eventStatus.state === "captains_assigned") {
          await setEventStatusMutation.mutateAsync("participants_assigned");
        }
        toast({
          title: "Participant assigned",
          description: "Assignment saved successfully.",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Assignment failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddToRestaurant = async (
    restaurantId: string,
    participantId: string
  ) => {
    if (!participantId) return;
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description:
          "Assignments are locked. Unfinalize the event to add participants.",
        variant: "destructive",
      });
      return;
    }

    try {
      await assignMutation.mutateAsync({
        participant_id: participantId,
        restaurant_id: restaurantId,
      });
      if (eventStatus.state === "captains_assigned") {
        await setEventStatusMutation.mutateAsync("participants_assigned");
      }
      toast({
        title: "Participant added",
        description: "The participant was assigned to the restaurant.",
      });
      setPendingAdd((prev) => ({ ...prev, [restaurantId]: "" }));
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to assign participant",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExport = async () => {
    if (!assignments.length) {
      toast({
        title: "No assignments yet",
        description: "Assign participants before exporting.",
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

    const csv = generateAssignmentCsv(rosters);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `blind-peering-assignments-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(buildRosterPrintHtml(rosters));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }

    toast({
      title: "Export ready",
      description: "CSV downloaded and print preview opened.",
    });
  };

  const handleSendIndividualEmail = async (participantId: string) => {
    const participant = participantById.get(participantId);
    if (!participant) return;

    const assignmentRestaurantId = assignmentsByParticipant[participantId];
    if (!assignmentRestaurantId) {
      toast({
        title: "No assignment",
        description: "This participant is not assigned to a restaurant yet.",
        variant: "destructive",
      });
      return;
    }

    const restaurant = restaurants.find((r) => r.id === assignmentRestaurantId);
    if (!restaurant) return;

    const captain = restaurant.assigned_captain_id
      ? participantById.get(restaurant.assigned_captain_id) ?? null
      : null;

    const tableGuestIds = assignmentsByRestaurant[assignmentRestaurantId] ?? [];
    const tableGuests = tableGuestIds
      .map((id) => participantById.get(id))
      .filter((p): p is (typeof participants)[0] => Boolean(p))
      .filter((p) => p.id !== participantId);

    try {
      await sendEmailMutation.mutateAsync({
        participant,
        restaurant,
        captain,
        tableGuests,
        emailType: "individual_update",
      });
      toast({
        title: "Email sent",
        description: `Assignment email sent to ${participant.attendee_name}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Failed to send email",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const dataLoading =
    participantsLoading || restaurantsLoading || assignmentsLoading;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Assignments
        </h2>
        <p className="text-muted-foreground">
          Search, reassign, or clear participant restaurant placements.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by person name, email, Pretix ID, or restaurant…"
            className="flex-1 min-w-[220px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2 bg-transparent"
              onClick={handleExport}
              disabled={!assignments.length}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="people" className="gap-2">
            <Users className="h-4 w-4" />
            By People
          </TabsTrigger>
          <TabsTrigger value="restaurants" className="gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            By Restaurant
          </TabsTrigger>
        </TabsList>
        <TabsContent value="people" className="space-y-4">
          {excludedDuplicates.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Duplicate Emails Excluded</AlertTitle>
              <AlertDescription>
                {excludedDuplicates.length} participant
                {excludedDuplicates.length > 1 ? "s" : ""} with duplicate email
                addresses {excludedDuplicates.length > 1 ? "have" : "has"} been
                excluded from assignment. Please fix duplicate emails in the
                People page before generating assignments.
              </AlertDescription>
            </Alert>
          )}
          <AssignmentsPeopleList
            isLoading={dataLoading}
            paginatedPeople={paginatedPeople}
            totalFilteredCount={filteredPeople.length}
            assignmentsByParticipant={assignmentsByParticipant}
            restaurants={restaurants}
            firstEmailByParticipant={firstEmailByParticipant}
            isBusy={isBusy}
            isFinalized={isFinalized}
            onSendEmail={handleSendIndividualEmail}
            onAssign={handleManualAssign}
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            sendingEmailId={sendEmailMutation.isPending ? sendEmailMutation.variables?.participant.id : undefined}
          />
        </TabsContent>
        <TabsContent value="restaurants" className="space-y-4">
          <AssignmentsRestaurantList
            isLoading={dataLoading}
            filteredRestaurants={filteredRestaurants}
            assignmentsByRestaurant={assignmentsByRestaurant}
            participantById={participantById}
            unassignedParticipants={unassignedParticipants}
            isBusy={isBusy}
            isFinalized={isFinalized}
            onMove={(id) => handleManualAssign(id, null)}
            onAdd={handleAddToRestaurant}
            pendingAdd={pendingAdd}
            setPendingAdd={setPendingAdd}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
