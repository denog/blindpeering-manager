/**
 * People Management Component
 *
 * Main interface for managing event participants.
 */

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Plus, RefreshCw, UploadCloud } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { usePeopleLogic } from "@/hooks/use-people-logic";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  ParticipantDialog,
  type DialogMode,
  type ParticipantFormValues,
} from "@/components/people/participant-dialog";
import { PeopleStats } from "@/components/people/people-stats";
import { PeopleFilters } from "@/components/people/people-filters";
import { PeopleTable } from "@/components/people/people-table";

// ============================================================================
// Component State Types
// ============================================================================

interface ParticipantDialogState {
  open: boolean;
  mode: DialogMode;
  participantId?: string;
}

/** Expected CSV column structure for bulk import */
type ParticipantCsvRow = {
  given_name?: string;
  family_name?: string;
  attendee_name?: string;
  attendee_email?: string;
  is_table_captain?: string | boolean;
  captain_phone?: string;
  captain_preferred_contact?: string;
  status?: string;
};

// ============================================================================
// Constants
// ============================================================================

/** Available contact methods for table captains */
const CAPTAIN_PREFERRED_CONTACT_OPTIONS = [
  "email",
  "phone",
  "sms",
  "whatsapp",
  "telegram",
  "signal",
] as const;

type CaptainPreferredContact = (typeof CAPTAIN_PREFERRED_CONTACT_OPTIONS)[number];

/** Type guard to validate captain contact method values */
const isCaptainPreferredContact = (
  value: unknown
): value is CaptainPreferredContact => {
  return (
    typeof value === "string" &&
    CAPTAIN_PREFERRED_CONTACT_OPTIONS.includes(value as CaptainPreferredContact)
  );
};


// ============================================================================
// Main Component
// ============================================================================

export function PeopleManagement() {
  const {
    participants,
    isLoading,
    restaurants,
    removeParticipant,
    editParticipant,
    bulkImportParticipants,
    syncFromPretix,
    editRestaurant,
    unassignMutation,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    captainFilter,
    setCaptainFilter,
    emailFilter,
    setEmailFilter,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    restaurantById,
    assignmentByParticipant,
    firstEmailByParticipant,
    duplicateEmails,
    filteredParticipants,
    eligibleForAssignment,
    totalCaptains,
    participantsWithDuplicateEmails,
    paginatedParticipants,
    totalPages,
  } = usePeopleLogic();
  
  const { toast } = useToast();

  const [dialogState, setDialogState] = useState<ParticipantDialogState>({
    open: false,
    mode: "create",
  });
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openDialog = (mode: DialogMode, participantId?: string) => {
    setDialogState({ open: true, mode, participantId });
  };

  const closeDialog = () => {
    setDialogState((prev) => ({ ...prev, open: false }));
  };

  const handleDelete = async (participantId: string) => {
    const participant = participants.find((item) => item.id === participantId);
    if (!participant) return;
    try {
      await removeParticipant.mutateAsync(participantId);
      toast({
        title: "Participant removed",
        description: `${participant.attendee_name} has been removed.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to remove participant",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (participantId: string) => {
    const participant = participants.find((item) => item.id === participantId);
    if (!participant) return;

    const newStatus =
      participant.status === "cancelled" ? "registered" : "cancelled";

    try {
      // Update participant status and mark as manually overridden
      await editParticipant.mutateAsync({
        id: participantId,
        payload: {
          status: newStatus,
          manual_status_override: true,
        },
      });

      // If cancelling, remove their assignment and captain assignment
      if (newStatus === "cancelled") {
        // Remove from assignments table (if they are a regular attendee)
        const assignment = assignmentByParticipant[participantId];
        if (assignment) {
          await unassignMutation.mutateAsync(participantId);
        }

        // Remove from restaurants table (if they are a captain)
        const captainRestaurant = restaurants.find(
          (r) => r.assigned_captain_id === participantId
        );
        if (captainRestaurant) {
          await editRestaurant.mutateAsync({
            id: captainRestaurant.id,
            payload: {
              assigned_captain_id: null,
            },
          });
        }
      }

      toast({
        title:
          newStatus === "cancelled"
            ? "Participant cancelled"
            : "Participant reactivated",
        description: `${participant.attendee_name} has been ${
          newStatus === "cancelled" ? "cancelled" : "reactivated"
        }.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to update status",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleSyncFromPretix = async () => {
    try {
      const result = await syncFromPretix.mutateAsync();
      toast({
        title: "Sync completed",
        description: `New: ${result.newParticipants}, Updated: ${result.updatedParticipants}, Cancelled: ${result.cancelledParticipants}`,
      });
      if (result.errors.length > 0) {
        console.error("Sync errors:", result.errors);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Sync failed",
        description:
          error instanceof Error
            ? error.message
            : "Please check your Pretix configuration.",
        variant: "destructive",
      });
    }
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    event
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await new Promise<Papa.ParseResult<ParticipantCsvRow>>(
        (resolve, reject) => {
          Papa.parse<ParticipantCsvRow>(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim().toLowerCase(),
            complete: resolve,
            error: reject,
          });
        }
      );

      if (parsed.errors.length > 0) {
        throw new Error(parsed.errors[0].message);
      }

      const payload = parsed.data
        .filter((row) => Boolean(row.attendee_email))
        .map((row) => ({
          given_name: row.given_name ? String(row.given_name) : "",
          family_name: row.family_name ? String(row.family_name) : "",
          attendee_name: row.attendee_name
            ? String(row.attendee_name)
            : `${row.given_name ?? ""} ${row.family_name ?? ""}`.trim(),
          attendee_email: String(row.attendee_email),
          is_table_captain:
            typeof row.is_table_captain === "boolean"
              ? row.is_table_captain
              : String(row.is_table_captain ?? "").toLowerCase() === "true",
          captain_phone: row.captain_phone ? String(row.captain_phone) : null,
          captain_preferred_contact: isCaptainPreferredContact(
            row.captain_preferred_contact
          )
            ? row.captain_preferred_contact
            : null,
          status:
            row.status &&
            ["registered", "cancelled", "late_joiner"].includes(
              String(row.status)
            )
              ? (String(row.status) as ParticipantFormValues["status"])
              : "registered",
        }));

      if (!payload.length) {
        toast({
          title: "No rows imported",
          description: "We could not find any valid rows in that CSV.",
        });
        return;
      }

      const result = await bulkImportParticipants.mutateAsync(payload);
      const totalRows = payload.length;
      const uniqueParticipants = result.succeeded + result.failed;

      if (result.failed === 0) {
        const duplicatesInCsv = totalRows - uniqueParticipants;
        const message =
          duplicatesInCsv > 0
            ? `${result.succeeded} participant${
                result.succeeded === 1 ? "" : "s"
              } processed from ${totalRows} CSV rows (${duplicatesInCsv} duplicate${
                duplicatesInCsv === 1 ? "" : "s"
              } in CSV).`
            : `${result.succeeded} participant${
                result.succeeded === 1 ? "" : "s"
              } imported successfully.`;

        toast({
          title: "Import successful",
          description: message,
        });
      } else if (result.succeeded === 0) {
        toast({
          title: "Import failed",
          description: `All ${result.failed} participant${
            result.failed === 1 ? "" : "s"
          } failed to import. ${result.errors[0]?.reason || ""}`,
          variant: "destructive",
        });
      } else {
        const duplicateCount = result.errors.filter(
          (e) =>
            e.reason.includes("duplicate key") ||
            e.reason.includes("already exists")
        ).length;
        const duplicateEmails = result.errors
          .filter(
            (e) =>
              e.reason.includes("duplicate key") ||
              e.reason.includes("already exists")
          )
          .slice(0, 3)
          .map((e) => e.email);

        toast({
          title: "Partial import",
          description: `${result.succeeded} imported, ${
            result.failed
          } skipped (${duplicateCount} duplicate${
            duplicateCount === 1 ? "" : "s"
          }: ${duplicateEmails.join(", ")}${duplicateCount > 3 ? "..." : ""})`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Import failed",
        description:
          error instanceof Error
            ? error.message
            : "We could not parse that CSV. Please ensure it includes an Email column.",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Participant Management
          </h2>
          <p className="text-muted-foreground">
            Keep attendee information up-to-date and ready for assignment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={handleSyncFromPretix}
            disabled={syncFromPretix.isPending}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                syncFromPretix.isPending && "animate-spin"
              )}
            />
            <span className="hidden sm:inline">
              {syncFromPretix.isPending ? "Syncing..." : "Sync from Pretix"}
            </span>
            <span className="sm:hidden">Sync</span>
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={handleImportClick}
          >
            <UploadCloud className="h-4 w-4" />
            <span className="hidden sm:inline">Import CSV</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button className="gap-2" onClick={() => openDialog("create")}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Participant</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <PeopleStats
        totalParticipants={participants.length}
        eligibleForAssignment={eligibleForAssignment}
        totalCaptains={totalCaptains}
        totalAssignments={Object.keys(assignmentByParticipant).length}
        participantsWithDuplicateEmails={participantsWithDuplicateEmails}
      />

      <PeopleFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        captainFilter={captainFilter}
        setCaptainFilter={setCaptainFilter}
        emailFilter={emailFilter}
        setEmailFilter={setEmailFilter}
      />

      <PeopleTable
        isLoading={isLoading}
        participants={filteredParticipants}
        paginatedParticipants={paginatedParticipants}
        assignmentByParticipant={assignmentByParticipant}
        restaurantById={restaurantById}
        firstEmailByParticipant={firstEmailByParticipant}
        duplicateEmails={duplicateEmails}
        onToggleStatus={handleToggleStatus}
        onEdit={(id) => openDialog("edit", id)}
        onDelete={handleDelete}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredParticipants.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      <ParticipantDialog
        open={dialogState.open}
        onOpenChange={(open) =>
          open ? setDialogState((state) => ({ ...state, open })) : closeDialog()
        }
        mode={dialogState.mode}
        participantId={dialogState.participantId}
      />
    </div>
  );
}
