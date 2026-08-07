/**
 * Email Templates Card Component
 *
 * Displays the two editable email templates (participant restaurant
 * assignment, table captain guest list overview) with an edit button that
 * opens a modal for changing their subject/body. Templates are prepopulated
 * with sensible defaults and can be reset back to them at any time.
 */

import { useEffect, useState } from "react";
import { Mail, Pencil, RotateCcw } from "lucide-react";

import {
  useEventStatus,
  type EmailTemplateKey,
} from "@/hooks/use-event-status";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ASSIGNMENT_PLACEHOLDERS = [
  "event_name",
  "event_date",
  "arrival_time",
  "participant_name",
  "restaurant_name",
  "restaurant_address",
  "reservation_name",
  "taxi_time",
  "pt_time",
  "pt_lines",
  "captain_name",
  "captain_email",
  "captain_phone",
  "captain_contact",
  "table_guests",
];

const CAPTAIN_OVERVIEW_PLACEHOLDERS = [
  "event_name",
  "restaurant_name",
  "restaurant_address",
  "captain_name",
  "captain_email",
  "guest_list",
];

function PlaceholderHints({ placeholders }: { placeholders: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {placeholders.map((placeholder) => (
        <Badge key={placeholder} variant="secondary" className="font-mono">
          {`{${placeholder}}`}
        </Badge>
      ))}
    </div>
  );
}

export function EmailTemplatesCard() {
  const { toast } = useToast();
  const { eventStatus, updateSettingsMutation, resetEmailTemplateMutation } =
    useEventStatus();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EmailTemplateKey>("assignment");
  const [assignmentSubject, setAssignmentSubject] = useState("");
  const [assignmentBody, setAssignmentBody] = useState("");
  const [captainOverviewSubject, setCaptainOverviewSubject] = useState("");
  const [captainOverviewBody, setCaptainOverviewBody] = useState("");

  useEffect(() => {
    if (isDialogOpen) {
      setAssignmentSubject(eventStatus.assignment_email_subject);
      setAssignmentBody(eventStatus.assignment_email_body);
      setCaptainOverviewSubject(eventStatus.captain_overview_email_subject);
      setCaptainOverviewBody(eventStatus.captain_overview_email_body);
    }
  }, [
    isDialogOpen,
    eventStatus.assignment_email_subject,
    eventStatus.assignment_email_body,
    eventStatus.captain_overview_email_subject,
    eventStatus.captain_overview_email_body,
  ]);

  const handleSave = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        assignment_email_subject: assignmentSubject,
        assignment_email_body: assignmentBody,
        captain_overview_email_subject: captainOverviewSubject,
        captain_overview_email_body: captainOverviewBody,
      });
      setIsDialogOpen(false);
      toast({
        title: "Templates saved",
        description: "Email templates have been updated.",
      });
    } catch (error) {
      toast({
        title: "Failed to save templates",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReset = async (template: EmailTemplateKey) => {
    try {
      const updated = await resetEmailTemplateMutation.mutateAsync(template);
      if (template === "assignment") {
        setAssignmentSubject(updated.assignment_email_subject);
        setAssignmentBody(updated.assignment_email_body);
      } else {
        setCaptainOverviewSubject(updated.captain_overview_email_subject);
        setCaptainOverviewBody(updated.captain_overview_email_body);
      }
      toast({
        title: "Template reset",
        description: "Restored the default subject and body.",
      });
    } catch (error) {
      toast({
        title: "Failed to reset template",
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
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>
                Subject and body for the participant assignment and table
                captain overview emails.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Participant Assignment
              </p>
              <p className="font-medium truncate">
                {eventStatus.assignment_email_subject}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Captain Overview
              </p>
              <p className="font-medium truncate">
                {eventStatus.captain_overview_email_subject}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Email Templates</DialogTitle>
            <DialogDescription>
              Use the placeholders below in the subject or body — they're
              filled in automatically when an email is sent.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as EmailTemplateKey)}
          >
            <TabsList>
              <TabsTrigger value="assignment">Participant Assignment</TabsTrigger>
              <TabsTrigger value="captain_overview">Captain Overview</TabsTrigger>
            </TabsList>

            <TabsContent value="assignment" className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="assignment-subject">Subject</Label>
                <Input
                  id="assignment-subject"
                  value={assignmentSubject}
                  onChange={(e) => setAssignmentSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignment-body">Body</Label>
                <Textarea
                  id="assignment-body"
                  className="min-h-[280px] font-mono text-sm"
                  value={assignmentBody}
                  onChange={(e) => setAssignmentBody(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Available placeholders</p>
                <PlaceholderHints placeholders={ASSIGNMENT_PLACEHOLDERS} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleReset("assignment")}
                disabled={resetEmailTemplateMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to default
              </Button>
            </TabsContent>

            <TabsContent value="captain_overview" className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="captain-overview-subject">Subject</Label>
                <Input
                  id="captain-overview-subject"
                  value={captainOverviewSubject}
                  onChange={(e) => setCaptainOverviewSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="captain-overview-body">Body</Label>
                <Textarea
                  id="captain-overview-body"
                  className="min-h-[280px] font-mono text-sm"
                  value={captainOverviewBody}
                  onChange={(e) => setCaptainOverviewBody(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Available placeholders</p>
                <PlaceholderHints placeholders={CAPTAIN_OVERVIEW_PLACEHOLDERS} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleReset("captain_overview")}
                disabled={resetEmailTemplateMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to default
              </Button>
            </TabsContent>
          </Tabs>

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
