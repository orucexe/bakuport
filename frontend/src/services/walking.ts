import type { Journey } from "../pages/journeyTypes";
import type { Place } from "../components/PlacePicker";

/** Refine a bounded set of candidates; a denied service never becomes fake geometry. */
export async function refineWalking(
  journeys: Journey[],
  limit: number,
  signal: AbortSignal,
): Promise<Journey[]> {
  const output = journeys.map((journey) => ({
    ...journey,
    walking_status: "estimate" as Journey["walking_status"],
  }));
  if (typeof google === "undefined" || !google.maps?.importLibrary)
    return output;
  try {
    const { Route } = (await google.maps.importLibrary(
      "routes",
    )) as google.maps.RoutesLibrary;
    if (!Route) return output;
    const cache = new Map<
      string,
      {
        shape: Place[];
        minutes: number;
        distance_m: number;
        warnings: string[];
      }
    >();
    for (let index = 0; index < Math.min(3, output.length); index++) {
      if (signal.aborted) return output;
      const journey = output[index];
      if (!journey.legs?.length) continue;
      const legs = journey.legs.map((leg) => ({ ...leg }));
      const warnings: string[] = [];
      for (const leg of legs) {
        if (leg.type !== "walk" || leg.distance_m < 5) continue;
        const key = [leg.from.lat, leg.from.lng, leg.to.lat, leg.to.lng].join(
          ":",
        );
        let resolved = cache.get(key);
        if (!resolved) {
          const response = await Route.computeRoutes({
            origin: { lat: leg.from.lat, lng: leg.from.lng },
            destination: { lat: leg.to.lat, lng: leg.to.lng },
            travelMode: "WALKING",
            fields: ["path", "distanceMeters", "durationMillis", "warnings"],
          });
          const route = response.routes?.[0];
          if (
            !route?.path?.length ||
            !Number.isFinite(route.distanceMeters) ||
            !Number.isFinite(route.durationMillis)
          )
            throw Error("Walking route unavailable");
          resolved = {
            shape: route.path.map((p) => ({
              lat: p.lat,
              lng: p.lng,
              name: "",
            })),
            distance_m: route.distanceMeters!,
            minutes: route.durationMillis! / 60000,
            warnings: route.warnings || [],
          };
          cache.set(key, resolved);
        }
        Object.assign(leg, {
          shape: resolved.shape,
          distance_m: resolved.distance_m,
          minutes: resolved.minutes,
          estimated: false,
        });
        warnings.push(...resolved.warnings);
      }
      if (signal.aborted) return output;
      const before = legs[0],
        after = legs[2];
      output[index] = {
        ...journey,
        legs,
        walk_to_m: before.distance_m,
        walk_from_m: after.distance_m,
        walk_to_minutes: before.minutes,
        walk_from_minutes: after.minutes,
        planned_minutes: Math.ceil(
          legs.reduce((sum, leg) => sum + leg.minutes, 0),
        ),
        walking_status:
          before.distance_m > limit || after.distance_m > limit
            ? "over_limit"
            : "provider",
        walking_warnings: [...new Set(warnings)],
      };
    }
  } catch {
    /* Keep explicit straight-line estimates when Routes is unavailable/denied. */
  }
  return output
    .filter((journey) => journey.walking_status !== "over_limit")
    .sort((a, b) => a.planned_minutes - b.planned_minutes);
}
