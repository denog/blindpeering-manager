import { useMemo } from "react";

import { useRestaurants } from "@/hooks/use-restaurants";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function RestaurantsStatCard() {
  const { restaurants } = useRestaurants();

  const totalCapacity = useMemo(
    () => restaurants.reduce((total, r) => total + r.max_seats, 0),
    [restaurants]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Restaurants</CardTitle>
        <CardDescription className="break-words">
          Capacity including captains
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-semibold">{restaurants.length}</span>
          <Badge variant="outline" className="break-words">
            {totalCapacity} seats
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
