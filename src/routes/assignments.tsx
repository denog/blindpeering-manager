import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { AssignmentsView } from "@/components/assignments-view";

export const Route = createFileRoute("/assignments")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <DashboardLayout>
      <AssignmentsView />
    </DashboardLayout>
  );
}
