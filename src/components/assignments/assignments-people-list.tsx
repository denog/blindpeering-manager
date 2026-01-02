import {
  AlertTriangle,
  Mail,
  MailCheck,
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
import { Pagination } from "@/components/pagination";
import type { Participant, Restaurant } from "@/types/database";

interface AssignmentsPeopleListProps {
  isLoading: boolean;
  paginatedPeople: Participant[];
  totalFilteredCount: number;
  assignmentsByParticipant: Record<string, string>;
  restaurants: Restaurant[];
  firstEmailByParticipant: Map<string, any>;
  isBusy: boolean;
  isFinalized: boolean;
  onSendEmail: (participantId: string) => void;
  onAssign: (participantId: string, restaurantId: string | null) => void;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  sendingEmailId?: string | null;
}

export function AssignmentsPeopleList({
  isLoading,
  paginatedPeople,
  totalFilteredCount,
  assignmentsByParticipant,
  restaurants,
  firstEmailByParticipant,
  isBusy,
  isFinalized,
  onSendEmail,
  onAssign,
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  sendingEmailId,
}: AssignmentsPeopleListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants ({totalFilteredCount})</CardTitle>
        <CardDescription>
          Assign or move individuals between restaurants.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : totalFilteredCount === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No results</AlertTitle>
            <AlertDescription>
              Try adjusting your filters or import additional participants.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedPeople.map((participant) => {
                const assignmentRestaurantId =
                  assignmentsByParticipant[participant.id] ?? "";
                const restaurant = assignmentRestaurantId
                  ? restaurants.find(
                      (item) => item.id === assignmentRestaurantId
                    )
                  : undefined;
                const isCaptain = participant.is_table_captain;
                const firstEmail = firstEmailByParticipant.get(participant.id);
                const isSendingEmail = sendingEmailId === participant.id;

                return (
                  <div
                    key={participant.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          {participant.attendee_name}
                        </p>
                        {isCaptain && (
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary"
                          >
                            Captain
                          </Badge>
                        )}
                        {participant.status === "late_joiner" && (
                          <Badge
                            variant="outline"
                            className="text-warning border-warning"
                          >
                            Late joiner
                          </Badge>
                        )}
                        {firstEmail?.formattedDate && (
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15"
                            title={`First email (${firstEmail.emailType.replace(
                              "_",
                              " "
                            )}) sent ${firstEmail.formattedDate}`}
                          >
                            <MailCheck className="h-3.5 w-3.5 text-emerald-500" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {participant.attendee_email}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="text-right sm:text-left">
                        <p className="text-xs text-muted-foreground">
                          Current assignment
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {restaurant ? restaurant.name : "Unassigned"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {assignmentRestaurantId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onSendEmail(participant.id)}
                            disabled={isSendingEmail}
                            title="Send assignment email"
                          >
                            {isSendingEmail ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Select
                          value={assignmentRestaurantId || "unassigned"}
                          onValueChange={(value) =>
                            onAssign(
                              participant.id,
                              value === "unassigned" ? null : value
                            )
                          }
                          disabled={isBusy || isCaptain || isFinalized}
                        >
                          <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Assign restaurant" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">
                              Unassigned
                            </SelectItem>
                            {restaurants.map((restaurantOption) => (
                              <SelectItem
                                key={restaurantOption.id}
                                value={restaurantOption.id}
                              >
                                {restaurantOption.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalFilteredCount}
              itemsPerPage={itemsPerPage}
              onPageChange={onPageChange}
              itemLabel="participants"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
