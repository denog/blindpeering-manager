/**
 * Event Settings Card Component
 *
 * Displays event settings in read-only mode with an edit button
 * that opens a modal for editing:
 * - Event date
 * - Arrival time
 *
 * These settings are required for sending assignment emails.
 */

import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, Pencil, AlertTriangle } from "lucide-react";

import { useEventStatus } from "@/hooks/use-event-status";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not set";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeString: string | null): string {
  if (!timeString) return "Not set";
  const [hours, minutes] = timeString.split(":");
  return `${hours}:${minutes}`;
}

export function EventSettingsCard() {
  const { toast } = useToast();
  const { eventStatus, updateSettingsMutation } = useEventStatus();
  const { restaurants } = useRestaurants();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");

  // Sync form state when dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      setEventDate(eventStatus.event_date ?? "");
      setArrivalTime(eventStatus.arrival_time ?? "");
    }
  }, [isDialogOpen, eventStatus.event_date, eventStatus.arrival_time]);

  const isConfigured = eventStatus.event_date && eventStatus.arrival_time;

  // Check for restaurants missing reservation names
  const restaurantsMissingReservationName = useMemo(
    () => restaurants.filter((r) => !r.reservation_name),
    [restaurants]
  );

  const handleSave = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        event_date: eventDate || null,
        arrival_time: arrivalTime || null,
      });
      setIsDialogOpen(false);
      toast({
        title: "Settings saved",
        description: "Event settings have been updated.",
      });
    } catch (error) {
      toast({
        title: "Failed to save settings",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Event Settings
                {isConfigured ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    Needs Setup
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Event date and arrival time for assignment emails.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Event Date
              </p>
              <p className={`font-medium ${!eventStatus.event_date ? "text-muted-foreground" : ""}`}>
                {formatDate(eventStatus.event_date)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Arrival Time
              </p>
              <p className={`font-medium ${!eventStatus.arrival_time ? "text-muted-foreground" : ""}`}>
                {formatTime(eventStatus.arrival_time)}
              </p>
            </div>
          </div>

          {restaurantsMissingReservationName.length > 0 && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{restaurantsMissingReservationName.length} restaurant(s)</strong> missing reservation name (required for emails):{" "}
                {restaurantsMissingReservationName
                  .slice(0, 3)
                  .map((r) => r.name)
                  .join(", ")}
                {restaurantsMissingReservationName.length > 3 && ` and ${restaurantsMissingReservationName.length - 3} more`}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event Settings</DialogTitle>
            <DialogDescription>
              Configure the event date and arrival time. These are required for sending assignment emails.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event-date-time" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Event Date &amp; Arrival Time
              </Label>
              <DateTimePicker
                id="event-date-time"
                value={eventDate && arrivalTime ? `${eventDate}T${arrivalTime}` : null}
                onChange={(value) => {
                  const [date, time] = value?.split("T") ?? ["", ""];
                  setEventDate(date);
                  setArrivalTime(time);
                }}
                placeholder="Pick event date and arrival time"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateSettingsMutation.isPending}>
              {updateSettingsMutation.isPending && <Spinner className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
