import {
  AlertTriangle,
  Mail,
  MailCheck,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ParticipantCommentsModal } from "@/components/participant-comments-modal";
import { Pagination } from "@/components/pagination";
import { cn } from "@/lib/utils";
import type { Participant, Restaurant } from "@/types/database";

interface PeopleTableProps {
  isLoading: boolean;
  participants: Participant[];
  paginatedParticipants: Participant[];
  assignmentByParticipant: Record<string, string>;
  restaurantById: Map<string, Restaurant>;
  firstEmailByParticipant: Map<string, any>;
  duplicateEmails: Set<string>;
  onToggleStatus: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

const statusBadgeStyles: Record<string, string> = {
  registered: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  late_joiner: "bg-warning/10 text-warning",
};

export function PeopleTable({
  isLoading,
  participants,
  paginatedParticipants,
  assignmentByParticipant,
  restaurantById,
  firstEmailByParticipant,
  duplicateEmails,
  onToggleStatus,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PeopleTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants ({totalItems})</CardTitle>
        <CardDescription className="break-words">
          Update attendee data or remove cancellations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : participants.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No participants match the current filters.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Name</TableHead>
                  <TableHead className="min-w-[150px]">Email</TableHead>
                  <TableHead
                    className="text-center w-16"
                    title="First Email Sent"
                  >
                    <Mail className="h-4 w-4 mx-auto" />
                  </TableHead>
                  <TableHead className="min-w-[100px]">Role</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Restaurant</TableHead>
                  <TableHead className="text-right min-w-[140px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedParticipants.map((participant) => {
                  const assignmentRestaurantId =
                    assignmentByParticipant[participant.id];
                  const assignedRestaurant = assignmentRestaurantId
                    ? restaurantById.get(assignmentRestaurantId)
                    : undefined;
                  const firstEmail = firstEmailByParticipant.get(
                    participant.id
                  );

                  return (
                    <TableRow key={participant.id}>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground break-words">
                          {participant.attendee_name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="text-sm text-foreground break-all"
                            title={participant.attendee_email}
                          >
                            {participant.attendee_email}
                          </span>
                          {duplicateEmails.has(
                            participant.attendee_email.toLowerCase()
                          ) && (
                            <span title="Duplicate email - multiple participants share this address">
                              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {firstEmail && firstEmail.formattedDate ? (
                          <span
                            className="inline-flex items-center justify-center rounded-full bg-emerald-500/15 p-1"
                            title={`First email (${firstEmail.emailType.replace(
                              "_",
                              " "
                            )}) sent ${firstEmail.formattedDate}`}
                          >
                            <MailCheck className="h-4 w-4 text-emerald-500" />
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center text-muted-foreground"
                            title="No email sent yet"
                          >
                            <Mail className="h-4 w-4" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {participant.is_table_captain ? (
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary"
                          >
                            Captain
                          </Badge>
                        ) : (
                          <Badge variant="outline">Attendee</Badge>
                        )}
                        {participant.captain_phone && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {participant.captain_phone}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "px-2 py-1 text-xs",
                            statusBadgeStyles[participant.status]
                          )}
                        >
                          {participant.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {assignedRestaurant ? (
                          <div className="flex flex-col min-w-0">
                            <span
                              className="text-sm text-foreground break-words"
                              title={assignedRestaurant.name}
                            >
                              {assignedRestaurant.name}
                            </span>
                            <span
                              className="text-xs text-muted-foreground break-words"
                              title={assignedRestaurant.address}
                            >
                              {assignedRestaurant.address}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ParticipantCommentsModal
                            participantId={participant.id}
                            participantName={participant.attendee_name}
                          />
                          {participant.status === "cancelled" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onToggleStatus(participant.id)}
                              title="Reactivate participant"
                            >
                              <UserCheck className="h-4 w-4 text-success" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onToggleStatus(participant.id)}
                              title="Cancel participant"
                            >
                              <UserX className="h-4 w-4 text-warning" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(participant.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remove participant?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  They will be removed from assignments and
                                  lists. Continue?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => onDelete(participant.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={onPageChange}
          itemLabel="participants"
        />
      </CardContent>
    </Card>
  );
}
