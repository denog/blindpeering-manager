import { Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RestaurantCommentsModal } from "@/components/restaurant-comments-modal";
import { SearchInput } from "@/components/search-input";
import { cn, getOccupancyBadgeStyles } from "@/lib/utils";
import type { Restaurant, Participant } from "@/types/database";

interface RestaurantTableProps {
  isLoading: boolean;
  filteredRestaurants: Restaurant[];
  occupancyByRestaurant: Record<string, number>;
  captainById: Map<string, Participant>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function RestaurantTable({
  isLoading,
  filteredRestaurants,
  occupancyByRestaurant,
  captainById,
  searchQuery,
  setSearchQuery,
  onEdit,
  onDelete,
}: RestaurantTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Restaurants ({filteredRestaurants.length})</CardTitle>
        <CardDescription>
          Manage seating capacity, transport info, and captains.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, address, captain, or transit lines…"
        />
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead className="text-center">Occupancy</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Captain
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRestaurants.map((restaurant) => {
                  const occupancy = occupancyByRestaurant[restaurant.id] ?? 0;
                  const captain = restaurant.assigned_captain_id
                    ? captainById.get(restaurant.assigned_captain_id)
                    : undefined;

                  return (
                    <TableRow key={restaurant.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="font-medium text-foreground">
                            {restaurant.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {restaurant.address}
                          </div>
                          {restaurant.phone && (
                            <a
                              href={`tel:${restaurant.phone}`}
                              className="text-xs text-primary hover:underline lg:hidden"
                            >
                              {restaurant.phone}
                            </a>
                          )}
                          {captain && (
                            <div className="text-xs text-muted-foreground xl:hidden">
                              Captain: {captain.attendee_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {restaurant.phone ? (
                          <a
                            href={`tel:${restaurant.phone}`}
                            className="text-sm text-primary hover:underline whitespace-nowrap"
                          >
                            {restaurant.phone}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            "justify-center px-3 py-1",
                            getOccupancyBadgeStyles(
                              occupancy,
                              restaurant.max_seats
                            )
                          )}
                        >
                          {occupancy}/{restaurant.max_seats}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {captain ? (
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground">
                              {captain.attendee_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {captain.attendee_email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <RestaurantCommentsModal
                            restaurantId={restaurant.id}
                            restaurantName={restaurant.name}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(restaurant.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete restaurant?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {restaurant.name} and any
                                  assignments tied to it. This action cannot be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => onDelete(restaurant.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
