import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import { useParticipants } from "@/hooks/use-participants";
import { useRestaurants } from "@/hooks/use-restaurants";
import { getDuplicateEmails } from "@/lib/utils";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function DashboardAlerts() {
  const { participants } = useParticipants();
  const { restaurants } = useRestaurants();

  const assignableParticipants = useMemo(
    () =>
      participants.filter(
        (p) => p.status === "registered" || p.status === "late_joiner"
      ),
    [participants]
  );

  const activeCaptains = useMemo(
    () =>
      participants.filter(
        (p) => p.is_table_captain && p.status !== "cancelled"
      ),
    [participants]
  );

  const duplicateEmails = useMemo(
    () => getDuplicateEmails(participants, (p) => p.attendee_email),
    [participants]
  );

  const excludedDuplicates = useMemo(
    () =>
      assignableParticipants.filter(
        (p) =>
          !p.is_table_captain &&
          duplicateEmails.has(p.attendee_email.toLowerCase())
      ),
    [assignableParticipants, duplicateEmails]
  );

  const totalCapacity = useMemo(
    () => restaurants.reduce((total, r) => total + r.max_seats, 0),
    [restaurants]
  );

  const capacityShortfall = assignableParticipants.length > totalCapacity;
  const captainShortfall = activeCaptains.length < restaurants.length;

  if (!capacityShortfall && !captainShortfall) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle>Setup requires attention</AlertTitle>
      <AlertDescription>
        {capacityShortfall && (
          <p>
            There are {assignableParticipants.length} assignable participants
            {excludedDuplicates.length > 0 &&
              ` (${
                assignableParticipants.length - excludedDuplicates.length
              } with unique emails)`}{" "}
            but only {totalCapacity} seats. Overbooking will be distributed
            fairly across restaurants.
          </p>
        )}
        {excludedDuplicates.length > 0 && !capacityShortfall && (
          <p className="text-amber-600">
            {excludedDuplicates.length} participant
            {excludedDuplicates.length > 1 ? "s have" : " has"} duplicate email
            addresses and will be excluded from assignment.
          </p>
        )}
        {captainShortfall && (
          <p>
            Only {activeCaptains.length} captains available for{" "}
            {restaurants.length} restaurants. Recruit additional captains before
            assigning Restaurants.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
