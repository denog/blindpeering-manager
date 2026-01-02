import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { RestaurantManagement } from "@/components/restaurant-management";

export const Route = createFileRoute("/restaurants")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <DashboardLayout>
      <RestaurantManagement />
    </DashboardLayout>
  );
}
