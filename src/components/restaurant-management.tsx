/**
 * Restaurant Management Component
 *
 * Main interface for managing restaurants/venues for the blind peering event.
 * Provides functionality to:
 *
 * - View all restaurants in a searchable table with capacity info
 * - Create, edit, and delete restaurants manually
 * - Import restaurants from CSV files
 * - Assign table captains to restaurants
 * - Track transport information (taxi time, public transport)
 * - Manage reservation details
 * - Add comments/notes to restaurants
 *
 * Key Features:
 * - Occupancy badges showing capacity status (under/at/over capacity)
 * - Captain assignment with dropdown selection
 * - Transport info for participant notifications
 * - Reservation tracking (channel, name, confirmation status)
 *
 * @see useRestaurants - Hook for restaurant data operations
 * @see RestaurantCommentsModal - Modal for managing restaurant comments
 */

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Plus, UploadCloud } from "lucide-react";

import { useRestaurants } from "@/hooks/use-restaurants";
import { useParticipants } from "@/hooks/use-participants";
import { useAssignments } from "@/hooks/use-assignments";
import { useToast } from "@/hooks/use-toast";
import { createEntityMap } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  RestaurantDialog,
  type DialogMode,
} from "@/components/restaurants/restaurant-dialog";
import { RestaurantStats } from "@/components/restaurants/restaurant-stats";
import { RestaurantTable } from "@/components/restaurants/restaurant-table";

// ============================================================================
// Types
// ============================================================================

interface RestaurantDialogState {
  open: boolean;
  mode: DialogMode;
  restaurantId?: string;
}

type RestaurantCsvRow = {
  name?: string;
  address?: string;
  phone?: string;
  max_seats?: string | number;
  taxi_time?: string | number;
  public_transport_time?: string | number;
  public_transport_lines?: string;
};

// ============================================================================
// Main Component
// ============================================================================

export function RestaurantManagement() {
  const { toast } = useToast();
  const {
    restaurants,
    isLoading: restaurantsLoading,
    removeRestaurant,
    bulkImportRestaurants,
  } = useRestaurants();
  const { participants } = useParticipants();
  const { assignments } = useAssignments();

  const [dialogState, setDialogState] = useState<RestaurantDialogState>({
    open: false,
    mode: "create",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const restaurantById = useMemo(
    () => createEntityMap(restaurants),
    [restaurants]
  );

  const captainById = useMemo(
    () => createEntityMap(participants),
    [participants]
  );

  const captainOptions = useMemo(
    () => participants.filter((participant) => participant.is_table_captain),
    [participants]
  );

  const occupancyByRestaurant = useMemo(() => {
    return restaurants.reduce<Record<string, number>>((acc, restaurant) => {
      const baseAssignments = assignments.filter(
        (assignment) => assignment.restaurant_id === restaurant.id
      ).length;
      const captainBonus = restaurant.assigned_captain_id ? 1 : 0;
      acc[restaurant.id] = baseAssignments + captainBonus;
      return acc;
    }, {});
  }, [restaurants, assignments]);

  const filteredRestaurants = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      return restaurants;
    }
    return restaurants.filter((restaurant) => {
      const captain = restaurant.assigned_captain_id
        ? captainById.get(restaurant.assigned_captain_id)
        : undefined;
      return (
        restaurant.name.toLowerCase().includes(term) ||
        restaurant.address.toLowerCase().includes(term) ||
        restaurant.public_transport_lines?.toLowerCase().includes(term) ||
        captain?.attendee_name.toLowerCase().includes(term) ||
        captain?.attendee_email.toLowerCase().includes(term)
      );
    });
  }, [restaurants, searchQuery, captainById]);

  const totalCapacity = useMemo(
    () =>
      restaurants.reduce(
        (total, restaurant) => total + restaurant.max_seats,
        0
      ),
    [restaurants]
  );
  const totalAssigned = useMemo(
    () =>
      restaurants.reduce(
        (total, restaurant) =>
          total + (occupancyByRestaurant[restaurant.id] ?? 0),
        0
      ),
    [restaurants, occupancyByRestaurant]
  );

  const handleDialogOpen = (
    mode: RestaurantDialogState["mode"],
    restaurantId?: string
  ) => {
    setDialogState({ open: true, mode, restaurantId });
  };

  const handleDialogClose = (open: boolean) => {
    setDialogState((state) => ({ ...state, open }));
  };

  const handleDelete = async (restaurantId: string) => {
    const target = restaurantById.get(restaurantId);
    if (!target) return;
    try {
      await removeRestaurant.mutateAsync(restaurantId);
      toast({
        title: "Restaurant removed",
        description: `${target.name} has been deleted.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to delete restaurant",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    event
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await new Promise<Papa.ParseResult<RestaurantCsvRow>>(
        (resolve, reject) => {
          Papa.parse<RestaurantCsvRow>(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim().toLowerCase(),
            complete: resolve,
            error: reject,
          });
        }
      );

      if (parsed.errors.length > 0) {
        throw new Error(parsed.errors[0].message);
      }

      const payload = parsed.data
        .filter(
          (row) =>
            Boolean(row.name) && Boolean(row.address) && Boolean(row.max_seats)
        )
        .map((row) => ({
          name: String(row.name),
          address: String(row.address),
          phone: row.phone ? String(row.phone) : null,
          max_seats:
            typeof row.max_seats === "number"
              ? row.max_seats
              : parseInt(String(row.max_seats)),
          taxi_time: row.taxi_time
            ? typeof row.taxi_time === "number"
              ? row.taxi_time
              : parseInt(String(row.taxi_time))
            : null,
          public_transport_time: row.public_transport_time
            ? typeof row.public_transport_time === "number"
              ? row.public_transport_time
              : parseInt(String(row.public_transport_time))
            : null,
          public_transport_lines: row.public_transport_lines
            ? String(row.public_transport_lines)
            : null,
        }));

      if (!payload.length) {
        toast({
          title: "No rows imported",
          description: "We could not find any valid rows in that CSV.",
        });
        return;
      }

      await bulkImportRestaurants.mutateAsync(payload);
      toast({
        title: "Restaurants imported",
        description: `${payload.length} restaurants processed successfully.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Import failed",
        description:
          error instanceof Error
            ? error.message
            : "We could not parse that CSV. Please ensure it includes name, address, and max_seats columns.",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Restaurant Management
          </h2>
          <p className="text-muted-foreground">
            Track capacity and assign table captains.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={handleImportClick}
          >
            <UploadCloud className="h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => handleDialogOpen("create")} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Restaurant
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <RestaurantStats
        totalRestaurants={restaurants.length}
        totalCapacity={totalCapacity}
        totalAssigned={totalAssigned}
      />

      <RestaurantTable
        isLoading={restaurantsLoading}
        filteredRestaurants={filteredRestaurants}
        occupancyByRestaurant={occupancyByRestaurant}
        captainById={captainById}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onEdit={(id) => handleDialogOpen("edit", id)}
        onDelete={handleDelete}
      />

      <RestaurantDialog
        open={dialogState.open}
        onOpenChange={handleDialogClose}
        mode={dialogState.mode}
        restaurantId={dialogState.restaurantId}
        captainOptions={captainOptions}
      />
    </div>
  );
}
