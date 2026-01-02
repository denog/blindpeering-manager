import { useEventStatus } from "@/hooks/use-event-status";

import { Badge } from "@/components/ui/badge";
import { EventSettingsCard } from "@/components/event-settings-card";
import {
  ParticipantsStatCard,
  CaptainsStatCard,
  AssignmentsStatCard,
  RestaurantsStatCard,
  DashboardAlerts,
  StatusOverviewCard,
  QuickActionsCard,
} from "@/components/dashboard";

const WORKFLOW_LABELS: Record<string, string> = {
  setup: "Setup",
  captains_assigned: "Captains Assigned",
  participants_assigned: "Participants Assigned",
  finalized: "Finalized",
};

export function DashboardOverview() {
  const { eventStatus } = useEventStatus();
  const workflowLabel = WORKFLOW_LABELS[eventStatus.state] ?? "Unknown";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Event Dashboard
          </h2>
        </div>
        <Badge variant="secondary" className="text-sm">
          State: {workflowLabel}
        </Badge>
      </div>

      <EventSettingsCard />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ParticipantsStatCard />
        <CaptainsStatCard />
        <AssignmentsStatCard />
        <RestaurantsStatCard />
      </div>

      <DashboardAlerts />

      <div className="grid gap-4 lg:grid-cols-2">
        <QuickActionsCard />
        <StatusOverviewCard />
      </div>
    </div>
  );
}
