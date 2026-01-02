import {
  AlertTriangle,
  ArrowRightLeft,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { Participant, Restaurant } from "@/types/database";
import { getOccupancyBadgeStyles } from "@/lib/utils";

interface AssignmentsRestaurantListProps {
  isLoading: boolean;
  filteredRestaurants: Restaurant[];
  assignmentsByRestaurant: Record<string, string[]>;
  participantById: Map<string, Participant>;
  unassignedParticipants: Participant[];
  isBusy: boolean;
  isFinalized: boolean;
  onMove: (participantId: string) => void;
  onAdd: (restaurantId: string, participantId: string) => void;
  pendingAdd: Record<string, string>;
  setPendingAdd: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function AssignmentsRestaurantList({
  isLoading,
  filteredRestaurants,
  assignmentsByRestaurant,
  participantById,
  unassignedParticipants,
  isBusy,
  isFinalized,
  onMove,
  onAdd,
  pendingAdd,
  setPendingAdd,
}: AssignmentsRestaurantListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Spinner className="h-6 w-6" />
        </CardContent>
      </Card>
    );
  }

  if (filteredRestaurants.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No restaurants match</AlertTitle>
        <AlertDescription>Double-check your search input.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {filteredRestaurants.map((restaurant) => {
        const assignedParticipantIds =
          assignmentsByRestaurant[restaurant.id] ?? [];
        const assignedParticipants = assignedParticipantIds
          .map((participantId) => participantById.get(participantId))
          .filter((participant): participant is Participant =>
            Boolean(participant)
          );

        const captain = restaurant.assigned_captain_id
          ? participantById.get(restaurant.assigned_captain_id)
          : undefined;
        const occupancy = assignedParticipants.length + (captain ? 1 : 0);

        return (
          <Card key={restaurant.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle>{restaurant.name}</CardTitle>
                  <CardDescription>{restaurant.address}</CardDescription>
                </div>
                <Badge
                  className={getOccupancyBadgeStyles(
                    occupancy,
                    restaurant.max_seats
                  )}
                >
                  {occupancy}/{restaurant.max_seats}
                </Badge>
              </div>
              {captain && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                  <Users className="h-4 w-4" />
                  <span>
                    Captain: {captain.attendee_name} ({captain.attendee_email})
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {assignedParticipants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No participants assigned yet.
                  </p>
                ) : (
                  assignedParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {participant.attendee_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {participant.attendee_email}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-muted-foreground"
                        onClick={() => onMove(participant.id)}
                        disabled={isBusy || isFinalized}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        Move
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={pendingAdd[restaurant.id] ?? "none"}
                  onValueChange={(value) => {
                    setPendingAdd((prev) => ({
                      ...prev,
                      [restaurant.id]: value,
                    }));
                    if (value && value !== "none") {
                      onAdd(restaurant.id, value);
                    }
                  }}
                  disabled={
                    isBusy || unassignedParticipants.length === 0 || isFinalized
                  }
                >
                  <SelectTrigger className="w-[260px]">
                    <SelectValue
                      placeholder={
                        unassignedParticipants.length
                          ? "Add participant…"
                          : "No unassigned participants"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select participant</SelectItem>
                    {unassignedParticipants.map((participant) => (
                      <SelectItem key={participant.id} value={participant.id}>
                        {participant.attendee_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
