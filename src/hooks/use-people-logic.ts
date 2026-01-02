import { useState, useMemo, useEffect } from "react";
import { useParticipants } from "@/hooks/use-participants";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useAssignments } from "@/hooks/use-assignments";
import { useEmails } from "@/hooks/use-emails";
import { getDuplicateEmails, createEntityMap } from "@/lib/utils";
import { useFirstEmailByParticipant } from "@/hooks/use-first-email-by-participant";

export type StatusFilter = "all" | "registered" | "cancelled" | "late_joiner";
export type CaptainFilter = "all" | "captain" | "attendee";
export type EmailFilter = "all" | "duplicates" | "unique";

export function usePeopleLogic() {
  const {
    participants,
    isLoading: isParticipantsLoading,
    removeParticipant,
    editParticipant,
    createParticipant,
    bulkImportParticipants,
    syncFromPretix,
  } = useParticipants();
  
  const { restaurants, editRestaurant } = useRestaurants();
  const { assignments, unassignMutation } = useAssignments();
  const { emailLogs } = useEmails();

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [captainFilter, setCaptainFilter] = useState<CaptainFilter>("all");
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // --------------------------------------------------------------------------
  // Derived Data
  // --------------------------------------------------------------------------
  const restaurantById = useMemo(
    () => createEntityMap(restaurants),
    [restaurants]
  );

  const assignmentByParticipant = useMemo(() => {
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

  const firstEmailByParticipant = useFirstEmailByParticipant(emailLogs);

  // Detect duplicate emails
  const duplicateEmails = useMemo(
    () => getDuplicateEmails(participants, (p) => p.attendee_email),
    [participants]
  );

  // Filter participants
  const filteredParticipants = useMemo(() => {
    return participants.filter((participant) => {
      const matchesSearch =
        searchTerm.length === 0 ||
        participant.attendee_name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        participant.attendee_email
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || participant.status === statusFilter;
      const matchesCaptain =
        captainFilter === "all" ||
        (captainFilter === "captain" && participant.is_table_captain) ||
        (captainFilter === "attendee" && !participant.is_table_captain);
      const matchesEmail =
        emailFilter === "all" ||
        (emailFilter === "duplicates" &&
          duplicateEmails.has(participant.attendee_email.toLowerCase())) ||
        (emailFilter === "unique" &&
          !duplicateEmails.has(participant.attendee_email.toLowerCase()));

      return matchesSearch && matchesStatus && matchesCaptain && matchesEmail;
    });
  }, [
    participants,
    searchTerm,
    statusFilter,
    captainFilter,
    emailFilter,
    duplicateEmails,
  ]);

  // Statistics
  const eligibleForAssignment = useMemo(() => {
    return participants.filter(
      (participant) =>
        (participant.status === "registered" ||
          participant.status === "late_joiner") &&
        !participant.is_table_captain &&
        !duplicateEmails.has(participant.attendee_email.toLowerCase())
    ).length;
  }, [participants, duplicateEmails]);

  const totalCaptains = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.is_table_captain && participant.status !== "cancelled"
      ).length,
    [participants]
  );

  const participantsWithDuplicateEmails = useMemo(() => {
    return participants.filter((p) =>
      duplicateEmails.has(p.attendee_email.toLowerCase())
    ).length;
  }, [participants, duplicateEmails]);

  // Pagination
  const paginatedParticipants = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredParticipants.slice(startIndex, endIndex);
  }, [filteredParticipants, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredParticipants.length / itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, captainFilter, emailFilter]);

  return {
    // Data & Loading
    participants,
    isLoading: isParticipantsLoading,
    restaurants,
    
    // Actions
    removeParticipant,
    editParticipant,
    createParticipant,
    bulkImportParticipants,
    syncFromPretix,
    editRestaurant,
    unassignMutation,

    // State & Setters
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

    // Computed
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
  };
}
