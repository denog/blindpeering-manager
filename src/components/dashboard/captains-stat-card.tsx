import { useMemo } from "react";

import { useParticipants } from "@/hooks/use-participants";
import { useRestaurants } from "@/hooks/use-restaurants";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function CaptainsStatCard() {
  const { participants } = useParticipants();
  const { restaurants } = useRestaurants();

  const activeCaptains = useMemo(
    () =>
      participants.filter(
        (p) => p.is_table_captain && p.status !== "cancelled"
      ),
    [participants]
  );

  const restaurantsWithCaptain = useMemo(
    () => restaurants.filter((r) => Boolean(r.assigned_captain_id)),
    [restaurants]
  );

  const captainCoverage =
    restaurants.length === 0
      ? 0
      : Math.min(
          (restaurantsWithCaptain.length / restaurants.length) * 100,
          100
        );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Captains Ready</CardTitle>
        <CardDescription className="break-words">
          Active captains vs restaurants needed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-semibold">
            {activeCaptains.length}
          </span>
          <Badge variant="outline" className="break-words">
            {restaurants.length} restaurants
          </Badge>
        </div>
        <Progress value={captainCoverage} className="h-2" />
      </CardContent>
    </Card>
  );
}
