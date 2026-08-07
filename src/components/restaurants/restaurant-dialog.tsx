import { useEffect, useMemo } from "react";
import { useForm, type Resolver } from "react-hook-form";
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
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useToast } from "@/hooks/use-toast";
import type { Participant } from "@/types/database";
import { createEntityMap } from "@/lib/utils";

// ============================================================================
// Form Preprocessing Utilities
// ============================================================================

const toOptionalNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return parsed;
};

const toOptionalString = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  return String(value);
};

// ============================================================================
// Form Schema & Validation
// ============================================================================

const restaurantSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    address: z.string().min(1, "Address is required"),
    phone: z
      .preprocess(toOptionalString, z.string().nullable())
      .optional()
      .default(null),
    max_seats: z
      .preprocess(
        (value) => Number(value),
        z.number({ invalid_type_error: "Max seats is required" }).int().min(1)
      )
      .describe("Maximum number of seats"),
    taxi_time: z
      .preprocess(toOptionalNumber, z.number().int().min(0).nullable())
      .describe("Taxi travel time in minutes")
      .optional()
      .default(null),
    public_transport_time: z
      .preprocess(toOptionalNumber, z.number().int().min(0).nullable())
      .describe("Public transport travel time in minutes")
      .optional()
      .default(null),
    public_transport_lines: z
      .preprocess(toOptionalString, z.string().nullable())
      .optional()
      .default(null),
    assigned_captain_id: z
      .preprocess(toOptionalString, z.string().nullable())
      .optional()
      .default(null),
    reservation_channel: z
      .preprocess(toOptionalString, z.string().nullable())
      .optional()
      .default(null),
    reservation_name: z
      .preprocess(toOptionalString, z.string().nullable())
      .optional()
      .default(null),
    reservation_confirmed: z
      .preprocess(toOptionalString, z.string().nullable())
      .optional()
      .default(null),
  })
  .transform((value) => ({
    ...value,
    phone: value.phone ?? null,
    taxi_time: value.taxi_time ?? null,
    public_transport_time: value.public_transport_time ?? null,
    public_transport_lines: value.public_transport_lines ?? null,
    assigned_captain_id: value.assigned_captain_id ?? null,
    reservation_channel: value.reservation_channel ?? null,
    reservation_name: value.reservation_name ?? null,
    reservation_confirmed: value.reservation_confirmed ?? null,
  }));

type RestaurantFormValues = z.output<typeof restaurantSchema>;

const initialFormValues: RestaurantFormValues = {
  name: "",
  address: "",
  phone: null,
  max_seats: 1,
  taxi_time: null,
  public_transport_time: null,
  public_transport_lines: null,
  assigned_captain_id: null,
  reservation_channel: null,
  reservation_name: null,
  reservation_confirmed: null,
};

export type DialogMode = "create" | "edit";

interface RestaurantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DialogMode;
  restaurantId?: string;
  captainOptions: Participant[];
}

export function RestaurantDialog({
  open,
  onOpenChange,
  mode,
  restaurantId,
  captainOptions,
}: RestaurantDialogProps) {
  const { restaurants, createRestaurant, editRestaurant } = useRestaurants();
  const { toast } = useToast();

  const form = useForm<RestaurantFormValues>({
    resolver: zodResolver(
      restaurantSchema
    ) as unknown as Resolver<RestaurantFormValues>,
    defaultValues: initialFormValues,
  });

  const restaurantById = useMemo(
    () => createEntityMap(restaurants),
    [restaurants]
  );

  useEffect(() => {
    if (open) {
      if (mode === "edit" && restaurantId) {
        const restaurant = restaurantById.get(restaurantId);
        if (restaurant) {
          form.reset({
            name: restaurant.name,
            address: restaurant.address,
            phone: restaurant.phone ?? null,
            max_seats: restaurant.max_seats,
            taxi_time: restaurant.taxi_time,
            public_transport_time: restaurant.public_transport_time,
            public_transport_lines: restaurant.public_transport_lines ?? null,
            assigned_captain_id: restaurant.assigned_captain_id ?? null,
            reservation_channel: restaurant.reservation_channel ?? null,
            reservation_name: restaurant.reservation_name ?? null,
            reservation_confirmed: restaurant.reservation_confirmed ?? null,
          });
        }
      } else {
        form.reset(initialFormValues);
      }
    }
  }, [open, mode, restaurantId, restaurants, form, restaurantById]);

  const handleSubmit = async (values: RestaurantFormValues) => {
    try {
      if (mode === "create") {
        await createRestaurant.mutateAsync({
          name: values.name,
          address: values.address,
          phone: values.phone ?? null,
          max_seats: values.max_seats,
          taxi_time: values.taxi_time ?? null,
          public_transport_time: values.public_transport_time ?? null,
          public_transport_lines: values.public_transport_lines ?? null,
          assigned_captain_id: values.assigned_captain_id ?? null,
          reservation_channel: values.reservation_channel ?? null,
          reservation_name: values.reservation_name ?? null,
          reservation_confirmed: values.reservation_confirmed ?? null,
        });
        toast({
          title: "Restaurant added",
          description: `${values.name} is now available for assignments.`,
        });
      } else if (mode === "edit" && restaurantId) {
        await editRestaurant.mutateAsync({
          id: restaurantId,
          payload: {
            name: values.name,
            address: values.address,
            phone: values.phone ?? null,
            max_seats: values.max_seats,
            taxi_time: values.taxi_time ?? null,
            public_transport_time: values.public_transport_time ?? null,
            public_transport_lines: values.public_transport_lines ?? null,
            assigned_captain_id: values.assigned_captain_id ?? null,
            reservation_channel: values.reservation_channel ?? null,
            reservation_name: values.reservation_name ?? null,
            reservation_confirmed: values.reservation_confirmed ?? null,
          },
        });
        toast({
          title: "Restaurant updated",
          description: `${values.name} has been updated.`,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to save restaurant",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Add restaurant"
              : "Edit restaurant"}
          </DialogTitle>
          <DialogDescription>
            Provide seating capacity and optional transport details.
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
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="The Steakhouse" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="123 Main St, City"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+1 234 567 8900"
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(event.target.value || null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="max_seats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max seats</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigned_captain_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Table captain</FormLabel>
                    <Select
                      value={field.value ?? "unassigned"}
                      onValueChange={(value) =>
                        field.onChange(value === "unassigned" ? null : value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {captainOptions.map((captain) => (
                          <SelectItem key={captain.id} value={captain.id}>
                            {captain.attendee_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxi_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxi time (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ""
                              ? null
                              : Number(event.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="public_transport_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public transport (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ""
                              ? null
                              : Number(event.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="public_transport_lines"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transit lines</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="U8, Tram 1"
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(event.target.value || null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reservation_channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reservation channel</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="phone, email, website..."
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(event.target.value || null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reservation_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reservation name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Name under which reservation was made"
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(event.target.value || null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reservation_confirmed"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Reservation confirmed</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pick confirmation date and time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createRestaurant.isPending || editRestaurant.isPending
                }
              >
                {mode === "create"
                  ? "Add restaurant"
                  : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
