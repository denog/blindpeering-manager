import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RestaurantStatsProps {
  totalRestaurants: number;
  totalCapacity: number;
  totalAssigned: number;
}

export function RestaurantStats({
  totalRestaurants,
  totalCapacity,
  totalAssigned,
}: RestaurantStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Restaurants</CardTitle>
          <CardDescription>Active locations for this event</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{totalRestaurants}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
          <CardDescription>Maximum number of guests</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{totalCapacity}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Assigned Guests</CardTitle>
          <CardDescription>Includes captains</CardDescription>
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "text-2xl font-semibold",
              totalAssigned > totalCapacity ? "text-destructive" : undefined
            )}
          >
            {totalAssigned}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
