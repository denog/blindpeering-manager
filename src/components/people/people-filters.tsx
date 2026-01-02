import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StatusFilter = "all" | "registered" | "cancelled" | "late_joiner";
export type CaptainFilter = "all" | "captain" | "attendee";
export type EmailFilter = "all" | "duplicates" | "unique";

interface PeopleFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  captainFilter: CaptainFilter;
  setCaptainFilter: (value: CaptainFilter) => void;
  emailFilter: EmailFilter;
  setEmailFilter: (value: EmailFilter) => void;
}

export function PeopleFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  captainFilter,
  setCaptainFilter,
  emailFilter,
  setEmailFilter,
}: PeopleFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
        <CardDescription className="break-words">
          Filter by status, captain availability, or email duplicates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative md:max-w-xs">
            <Input
              placeholder="Search by name or email…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pr-9"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-0.5 h-8 w-8"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value: StatusFilter) => setStatusFilter(value)}
          >
            <SelectTrigger className="md:max-w-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="registered">Registered</SelectItem>
              <SelectItem value="late_joiner">Late joiner</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={captainFilter}
            onValueChange={(value: CaptainFilter) => setCaptainFilter(value)}
          >
            <SelectTrigger className="md:max-w-xs">
              <SelectValue placeholder="Captain filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Captains & attendees</SelectItem>
              <SelectItem value="captain">Captains only</SelectItem>
              <SelectItem value="attendee">Attendees only</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={emailFilter}
            onValueChange={(value: EmailFilter) => setEmailFilter(value)}
          >
            <SelectTrigger className="md:max-w-xs">
              <SelectValue placeholder="Email filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All emails</SelectItem>
              <SelectItem value="duplicates">Duplicates only</SelectItem>
              <SelectItem value="unique">Unique only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
