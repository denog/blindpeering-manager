import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PeopleManagement } from "@/components/people-management";

export const Route = createFileRoute("/people")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <DashboardLayout>
      <PeopleManagement />
    </DashboardLayout>
  );
}
