import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PeopleStatsProps {
  totalParticipants: number;
  eligibleForAssignment: number;
  totalCaptains: number;
  totalAssignments: number;
  participantsWithDuplicateEmails: number;
}

export function PeopleStats({
  totalParticipants,
  eligibleForAssignment,
  totalCaptains,
  totalAssignments,
  participantsWithDuplicateEmails,
}: PeopleStatsProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Total Participants
          </CardTitle>
          <CardDescription className="break-words">
            Imported from Pretix
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{totalParticipants}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Eligible Participants
          </CardTitle>
          <CardDescription className="break-words">
            Can be assigned to tables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-success">
            {eligibleForAssignment}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Captains Ready</CardTitle>
          <CardDescription className="break-words">
            Available table captains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{totalCaptains}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Assignments</CardTitle>
          <CardDescription className="break-words">
            Participants currently placed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{totalAssignments}</p>
        </CardContent>
      </Card>
      <Card
        className={cn(
          participantsWithDuplicateEmails > 0 && "border-amber-500/50"
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Duplicate Emails
          </CardTitle>
          <CardDescription className="break-words">
            Excluded from assignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "text-2xl font-semibold",
              participantsWithDuplicateEmails > 0
                ? "text-amber-600"
                : "text-muted-foreground"
            )}
          >
            {participantsWithDuplicateEmails}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
