import { createFileRoute } from "@tanstack/react-router"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EmailLog } from "@/components/email-log"

export const Route = createFileRoute("/emails")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DashboardLayout>
      <EmailLog />
    </DashboardLayout>
  )
}
