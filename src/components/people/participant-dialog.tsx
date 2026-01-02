import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useParticipants } from "@/hooks/use-participants";
import { useToast } from "@/hooks/use-toast";

// ============================================================================
// Constants & Types
// ============================================================================

const CAPTAIN_PREFERRED_CONTACT_OPTIONS = [
  "email",
  "phone",
  "sms",
  "whatsapp",
  "telegram",
  "signal",
] as const;

type CaptainPreferredContact = (typeof CAPTAIN_PREFERRED_CONTACT_OPTIONS)[number];

const isCaptainPreferredContact = (
  value: unknown
): value is CaptainPreferredContact => {
  return (
    typeof value === "string" &&
    CAPTAIN_PREFERRED_CONTACT_OPTIONS.includes(value as CaptainPreferredContact)
  );
};

const participantSchema = z.object({
  given_name: z.string().min(1, "Given name is required"),
  family_name: z.string().min(1, "Family name is required"),
  attendee_name: z.string().min(1, "Attendee display name is required"),
  attendee_email: z.string().email("A valid email is required"),
  is_table_captain: z.boolean(),
  captain_phone: z.string().trim().min(1).optional(),
  captain_preferred_contact: z
    .enum(CAPTAIN_PREFERRED_CONTACT_OPTIONS)
    .optional(),
  status: z.enum(["registered", "cancelled", "late_joiner"]),
});

export type ParticipantFormValues = z.infer<typeof participantSchema>;

export type DialogMode = "create" | "edit";

const initialParticipantValues: ParticipantFormValues = {
  given_name: "",
  family_name: "",
  attendee_name: "",
  attendee_email: "",
  is_table_captain: false,
  captain_phone: undefined,
  captain_preferred_contact: undefined,
  status: "registered",
};

interface ParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DialogMode;
  participantId?: string;
}

export function ParticipantDialog({
  open,
  onOpenChange,
  mode,
  participantId,
}: ParticipantDialogProps) {
  const { participants, createParticipant, editParticipant } = useParticipants();
  const { toast } = useToast();

  const form = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema),
    defaultValues: initialParticipantValues,
  });

  // Reset form when dialog opens/closes or mode/id changes
  useEffect(() => {
    if (open) {
      if (mode === "edit" && participantId) {
        const participant = participants.find((item) => item.id === participantId);
        if (participant) {
          form.reset({
            given_name: participant.given_name,
            family_name: participant.family_name,
            attendee_name: participant.attendee_name,
            attendee_email: participant.attendee_email,
            is_table_captain: participant.is_table_captain,
            captain_phone: participant.captain_phone ?? undefined,
            captain_preferred_contact: isCaptainPreferredContact(
              participant.captain_preferred_contact
            )
              ? participant.captain_preferred_contact
              : undefined,
            status: participant.status,
          });
        }
      } else {
        form.reset(initialParticipantValues);
      }
    }
  }, [open, mode, participantId, participants, form]);

  const handleSubmit = async (values: ParticipantFormValues) => {
    try {
      if (mode === "create") {
        await createParticipant.mutateAsync({
          given_name: values.given_name,
          family_name: values.family_name,
          attendee_name: values.attendee_name,
          attendee_email: values.attendee_email,
          is_table_captain: values.is_table_captain,
          captain_phone: values.captain_phone?.trim()
            ? values.captain_phone.trim()
            : null,
          captain_preferred_contact: values.captain_preferred_contact ?? null,
          status: values.status,
        });
        toast({
          title: "Participant added",
          description: `${values.attendee_name} has been added.`,
        });
      } else if (mode === "edit" && participantId) {
        const existingParticipant = participants.find(
          (p) => p.id === participantId
        );
        const emailChanged =
          existingParticipant &&
          existingParticipant.attendee_email !== values.attendee_email;

        await editParticipant.mutateAsync({
          id: participantId,
          payload: {
            given_name: values.given_name,
            family_name: values.family_name,
            attendee_name: values.attendee_name,
            attendee_email: values.attendee_email,
            is_table_captain: values.is_table_captain,
            captain_phone: values.captain_phone?.trim()
              ? values.captain_phone.trim()
              : null,
            captain_preferred_contact: values.captain_preferred_contact ?? null,
            status: values.status,
            // Mark email as manually overridden if it was changed
            ...(emailChanged ? { manual_email_override: true } : {}),
          },
        });
        toast({
          title: "Participant updated",
          description: `${values.attendee_name}'s profile has been saved.`,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to save participant",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Add participant"
              : "Edit participant"}
          </DialogTitle>
          <DialogDescription>
            Manage attendee details used for restaurant assignments.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="registered">Registered</SelectItem>
                        <SelectItem value="late_joiner">
                          Late joiner
                        </SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="given_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Given name</FormLabel>
                    <FormControl>
                      <Input placeholder="Alice" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="family_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Family name</FormLabel>
                    <FormControl>
                      <Input placeholder="Johnson" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="attendee_name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Badge name</FormLabel>
                    <FormControl>
                      <Input placeholder="Alice Johnson" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="attendee_email"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="alice@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_table_captain"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <FormLabel>Table captain</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Captains can guide their table and receive export
                        summaries.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="captain_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Captain phone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+49 123 4567"
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(event.target.value || undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="captain_preferred_contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred contact</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? undefined : value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="telegram">Telegram</SelectItem>
                        <SelectItem value="signal">Signal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createParticipant.isPending || editParticipant.isPending
                }
              >
                {mode === "create"
                  ? "Add participant"
                  : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
